import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export interface Bill {
  id: string;
  tenantId: string;
  meterId: string;
  tariffId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  peakKwh: number;
  normalKwh: number;
  offPeakKwh: number;
  totalKwh: number;
  contractedDemandKva: number;
  recordedDemandKva: number;
  billedDemandKva: number;
  powerFactor: number;
  peakChargesPaisa: number;
  normalChargesPaisa: number;
  offPeakChargesPaisa: number;
  totalEnergyChargesPaisa: number;
  wheelingChargesPaisa: number;
  demandChargesPaisa: number;
  fuelAdjustmentPaisa: number;
  electricityDutyPaisa: number;
  pfPenaltyPaisa: number;
  dgChargesPaisa: number;
  subtotalPaisa: number;
  gstPaisa: number;
  totalBillPaisa: number;
  effectiveRatePaisaPerKwh: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillCalculation {
  readings: Array<{ kWh: number; slotType: string; ratePaisa: number }>;
  tariff: Record<string, unknown>;
  contractedDemandKVA?: number;
  recordedDemandKVA?: number;
  powerFactor?: number;
  dgKWh?: number;
  dgRatePaisa?: number;
}

export function useBills() {
  return useQuery({
    queryKey: ['bills'],
    queryFn: () => api<Bill[]>('/bills'),
  });
}

export function useBill(id: string) {
  return useQuery({
    queryKey: ['bills', id],
    queryFn: () => api<Bill>(`/bills/${id}`),
    enabled: !!id,
  });
}

export function useCalculateBill() {
  return useMutation({
    mutationFn: (data: BillCalculation) =>
      api<Record<string, unknown>>('/bills/calculate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useSaveBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api<Bill>('/bills', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    },
  });
}
