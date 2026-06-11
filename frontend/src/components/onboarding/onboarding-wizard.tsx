'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingPhase } from '@liqvia2/shared';
import { apiGet, apiPost } from '@/lib/api';
import { AuthResponse, OnboardingContext } from '@/lib/auth-types';
import { useAuth } from '@/lib/auth-context';
import { useLocale, useTranslations } from '@/lib/i18n';
import { createInitialOnboardingState } from '@/lib/onboarding-state';
import { OnboardingShell } from './onboarding-shell';
import { WelcomeStep } from './steps/welcome-step';
import { SelectCompanyStep } from './steps/select-company-step';
import { CompanyStep } from './steps/company-step';
import { TeamStep } from './steps/team-step';
import { UploadStep } from './steps/upload-step';
import { PreviewStep } from './steps/preview-step';
import { DoneStep } from './steps/done-step';

export function OnboardingWizard() {
  const router = useRouter();
  const { user, loading, refreshUser, selectCompany, enterDemoMode, applyAuthResponse } = useAuth();
  const { locale } = useLocale();
  const t = useTranslations();
  const [phase, setPhase] = useState<OnboardingPhase>('welcome');
  const [context, setContext] = useState<OnboardingContext | null>(null);
  const [state, setState] = useState(createInitialOnboardingState);
  const [creating, setCreating] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    const ctx = await apiGet<OnboardingContext>('/onboarding/context');
    setContext(ctx);
    if (ctx.phase === 'complete' || ctx.onboardingCompleted) {
      router.replace('/dashboard');
      return;
    }
    if (ctx.phase === 'select') {
      setPhase('select');
    } else if (ctx.phase === 'setup') {
      try {
        const status = await apiGet<{
          company: {
            name: string;
            industry: string | null;
            currency: string;
            fiscalYearStart: number;
            forecastHorizonWeeks: number;
            openingCashBalance: number | null;
            locale: string;
          };
        }>('/onboarding/status');
        setState((prev) => ({
          ...prev,
          company: {
            name: status.company.name,
            industry: status.company.industry ?? 'Construction',
            currency: status.company.currency,
            fiscalYearStart: status.company.fiscalYearStart,
            forecastHorizonWeeks: status.company.forecastHorizonWeeks,
            openingCashBalance: status.company.openingCashBalance ?? 0,
            locale: status.company.locale,
          },
        }));
        setPhase('upload');
      } catch {
        setPhase('company');
      }
    } else {
      setPhase('welcome');
    }
  }, [router]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      loadContext().catch(() => setPhase('welcome'));
    }
  }, [user, loadContext]);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      company: { ...prev.company, locale },
    }));
  }, [locale]);

  const goTo = useCallback((next: OnboardingPhase) => {
    setError(null);
    setPhase(next);
  }, []);

  const createCompany = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const members = state.teamMembers.filter((m) => m.name.trim() && m.email.trim());
      const res = await apiPost<AuthResponse>('/onboarding/create-company', {
        company: state.company,
        teamMembers: members.length > 0 ? members : undefined,
      });
      await applyAuthResponse(res);
      goTo('upload');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setCreating(false);
    }
  }, [state, applyAuthResponse, goTo]);

  const completeOnboarding = useCallback(async () => {
    setFinishing(true);
    setError(null);
    try {
      await apiPost('/onboarding/complete', {});
      await refreshUser();
      goTo('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup');
    } finally {
      setFinishing(false);
    }
  }, [refreshUser, goTo]);

  const handleSelectCompany = useCallback(
    async (companyId: string) => {
      setSelectingId(companyId);
      setError(null);
      try {
        await selectCompany(companyId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to select company');
        setSelectingId(null);
      }
    },
    [selectCompany],
  );

  const handleDemoMode = useCallback(async () => {
    setDemoLoading(true);
    setError(null);
    try {
      await enterDemoMode();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enter demo mode');
    } finally {
      setDemoLoading(false);
    }
  }, [enterDemoMode]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <OnboardingShell phase={phase}>
      {phase === 'welcome' && (
        <WelcomeStep
          onSetupCompany={() => goTo('company')}
          onDemoMode={() => void handleDemoMode()}
          demoLoading={demoLoading}
        />
      )}

      {phase === 'select' && context && (
        <SelectCompanyStep
          links={context.companyLinks}
          onSelect={(id) => void handleSelectCompany(id)}
          onDemoMode={() => void handleDemoMode()}
          selecting={selectingId}
          demoLoading={demoLoading}
          error={error}
        />
      )}

      {phase === 'company' && (
        <CompanyStep
          value={state.company}
          onChange={(company) => setState((s) => ({ ...s, company }))}
          onNext={() => goTo('team')}
        />
      )}

      {phase === 'team' && (
        <TeamStep
          teamMembers={state.teamMembers}
          onTeamChange={(teamMembers) => setState((s) => ({ ...s, teamMembers }))}
          onBack={() => goTo('company')}
          onNext={() => void createCompany()}
          submitting={creating}
          error={error}
        />
      )}

      {phase === 'upload' && user.companyId && (
        <UploadStep
          companyCurrency={state.company.currency}
          onBack={() => goTo('team')}
          onNext={() => goTo('preview')}
        />
      )}

      {phase === 'preview' && user.companyId && (
        <PreviewStep
          onBack={() => goTo('upload')}
          onFinish={() => void completeOnboarding()}
          finishing={finishing}
          error={error}
        />
      )}

      {phase === 'done' && <DoneStep />}
    </OnboardingShell>
  );
}
