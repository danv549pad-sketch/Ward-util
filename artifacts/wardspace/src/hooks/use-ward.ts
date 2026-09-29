import { useQueryClient } from '@tanstack/react-query';
import {
  getGetWardStaffStatusQueryKey, getGetWardSummaryQueryKey, getListStaffRequestsQueryKey, getListWardItemsQueryKey,
  useAddWardInterest, useCreateWardItem, useDeleteWardItem, useLoginWardStaff,
  useLogoutWardStaff, useRemoveWardInterest, useUpdateWardItem,
} from '@workspace/api-client-react';

export const kinds = ['schedule', 'activities', 'activity-suggestions', 'requests', 'suggestions', 'announcements', 'ward-guide', 'things-to-do', 'learning'] as const;
export type Kind = typeof kinds[number];
export const kindNames: Record<Kind, string> = {
  schedule: 'Schedule', activities: 'Activities', 'activity-suggestions': 'Activity ideas',
  requests: 'Practical requests', suggestions: 'General suggestions', announcements: 'Announcements',
  'ward-guide': 'Ward guide', 'things-to-do': 'Things to do', learning: 'Learning',
};

export function useWardActions() {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      ...kinds.map(kind => qc.invalidateQueries({ queryKey: getListWardItemsQueryKey(kind) })),
      qc.invalidateQueries({ queryKey: getListStaffRequestsQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetWardSummaryQueryKey() }),
    ]);
  };
  const create = useCreateWardItem({ mutation: { onSuccess: refresh } });
  const update = useUpdateWardItem({ mutation: { onSuccess: refresh } });
  const remove = useDeleteWardItem({ mutation: { onSuccess: refresh } });
  const addInterest = useAddWardInterest({ mutation: { onSuccess: refresh } });
  const removeInterest = useRemoveWardInterest({ mutation: { onSuccess: refresh } });
  const login = useLoginWardStaff({ mutation: { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getGetWardStaffStatusQueryKey() }); await refresh(); } } });
  const logout = useLogoutWardStaff({ mutation: { onSuccess: async () => {
    qc.removeQueries({ queryKey: getListWardItemsQueryKey('requests') });
    qc.removeQueries({ queryKey: getListStaffRequestsQueryKey() });
    await qc.invalidateQueries({ queryKey: getGetWardStaffStatusQueryKey() });
    await refresh();
  } } });
  return { create, update, remove, addInterest, removeInterest, login, logout };
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something did not work. Please try again.';
}