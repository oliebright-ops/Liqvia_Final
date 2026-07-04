'use client';

import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import type { DecisionCentreRequest, DecisionCentreResponseView } from '@/lib/module-types';

export function useDecisionCentre() {
  return useMutation({
    mutationFn: (request: DecisionCentreRequest) =>
      apiPost<DecisionCentreResponseView>('/decision-centre', request),
  });
}
