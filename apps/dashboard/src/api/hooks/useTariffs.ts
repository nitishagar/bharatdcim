import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';

export interface Tariff {
  id: string;
  stateCode: string;
  discom: string;
  category: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  billingUnit: string;
  baseEnergyRatePaisa: number;
  wheelingChargePaisa: number;
  demandChargePerKvaPaisa: number;
  demandRatchetPercent: number;
  minimumDemandKva: number;
  timeSlotsJson: string;
  fuelAdjustmentPaisa: number;
  fuelAdjustmentType: string;
  electricityDutyBps: number;
  pfThresholdBps: number;
  pfPenaltyRatePaisa: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function useTariffs() {
  return useQuery({
    queryKey: ['tariffs'],
    queryFn: () => api<Tariff[]>('/tariffs'),
  });
}

export function useCreateTariff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api<Tariff>('/tariffs', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tariffs'] }); toast.success('Tariff created'); },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useUpdateTariff(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Record<string, unknown>>) =>
      api<Tariff>(`/tariffs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tariffs'] }); toast.success('Tariff updated'); },
    onError: (e) => { toast.error(e.message); },
  });
}
