'use client';

import { OnboardingTeamMemberInput } from '@liqvia2/shared';
import { useTranslations } from '@/lib/i18n';
import { OnboardingNav } from '../onboarding-nav';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm text-slate-300';

export function TeamStep({
  teamMembers,
  onTeamChange,
  onBack,
  onNext,
  submitting,
  error,
}: {
  teamMembers: OnboardingTeamMemberInput[];
  onTeamChange: (next: OnboardingTeamMemberInput[]) => void;
  onBack: () => void;
  onNext: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const t = useTranslations();

  const canProceed =
    teamMembers.length === 0 ||
    teamMembers.every(
      (m) => m.name.trim() && m.email.trim() && (!m.password || m.password.length >= 8),
    );

  function addMember() {
    onTeamChange([
      ...teamMembers,
      { name: '', email: '', password: '', role: 'member' },
    ]);
  }

  function updateMember(index: number, patch: Partial<OnboardingTeamMemberInput>) {
    onTeamChange(teamMembers.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function removeMember(index: number) {
    onTeamChange(teamMembers.filter((_, i) => i !== index));
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white">{t('onboarding.team.title')}</h2>
      <p className="mt-2 text-sm text-slate-400">{t('onboarding.team.subtitle')}</p>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">
            {t('onboarding.team.membersSection')}
          </h3>
          <button
            type="button"
            onClick={addMember}
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            + {t('onboarding.team.addMember')}
          </button>
        </div>

        {teamMembers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t('onboarding.team.optional')}</p>
        ) : (
          <div className="mt-3 space-y-4">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMember(index)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    {t('onboarding.team.remove')}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    {t('onboarding.team.memberName')}
                    <input
                      value={member.name}
                      onChange={(e) => updateMember(index, { name: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    {t('onboarding.team.memberEmail')}
                    <input
                      type="email"
                      value={member.email}
                      onChange={(e) => updateMember(index, { email: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    {t('onboarding.team.memberPassword')}
                    <input
                      type="password"
                      minLength={8}
                      value={member.password ?? ''}
                      onChange={(e) => updateMember(index, { password: e.target.value })}
                      placeholder={t('onboarding.team.passwordOptional')}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    {t('onboarding.team.memberRole')}
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateMember(index, {
                          role: e.target.value as OnboardingTeamMemberInput['role'],
                        })
                      }
                      className={inputClass}
                    >
                      <option value="member">{t('onboarding.team.roles.member')}</option>
                      <option value="viewer">{t('onboarding.team.roles.viewer')}</option>
                      <option value="admin">{t('onboarding.team.roles.admin')}</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <OnboardingNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={t('onboarding.nav.nextUpload')}
        nextDisabled={!canProceed}
        nextLoading={submitting}
      />
    </div>
  );
}
