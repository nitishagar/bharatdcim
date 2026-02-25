import { useQuery } from '@tanstack/react-query';
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
