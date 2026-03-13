import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePlatformTenants, useCreateTenant, useUpdateTenant, type Tenant } from '../api/hooks/usePlatformTenants';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/formatDate';
import { createTenantSchema, type CreateTenantForm } from '../lib/schemas';

const columns: ColumnDef<Tenant, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'stateCode', header: 'State' },
  { id: 'gstin', header: 'GSTIN', accessorFn: (t) => t.gstin ?? '—' },
  { id: 'created', header: 'Created', accessorFn: (t) => t.createdAt, cell: ({ row }) => formatDate(row.original.createdAt) },
];

export function PlatformTenants() {
  const { data, isLoading, error, refetch } = usePlatformTenants();
  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tenants</h2>
        <button
          onClick={() => { setShowCreate(!showCreate); setEditTenant(null); }}
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
        >
          Create Tenant
        </button>
      </div>

      {showCreate && (
        <TenantFormComponent
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refetch(); }}
        />
      )}

      {editTenant && (
        <TenantFormComponent
          mode="edit"
          tenant={editTenant}
          onClose={() => setEditTenant(null)}
          onSaved={() => { setEditTenant(null); refetch(); }}
        />
      )}

      {!data?.length ? (
        <EmptyState message="No tenants found" />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Search tenants..."
          onRowClick={(t) => { setEditTenant(t); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

interface TenantFormProps {
  mode: 'create' | 'edit';
  tenant?: Tenant;
  onClose: () => void;
  onSaved: () => void;
}

function TenantFormComponent({ mode, tenant, onClose, onSaved }: TenantFormProps) {
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateTenantForm>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: tenant?.name ?? '',
      stateCode: tenant?.stateCode ?? '',
      gstin: tenant?.gstin ?? '',
      billingAddress: tenant?.billingAddress ?? '',
    },
  });

  const isPending = createTenant.isPending || updateTenant.isPending;

  async function onSubmit(formData: CreateTenantForm) {
    try {
      const payload = {
        name: formData.name,
        stateCode: formData.stateCode,
        gstin: formData.gstin || undefined,
        billingAddress: formData.billingAddress || undefined,
      };
      if (mode === 'create') {
        await createTenant.mutateAsync(payload);
      } else {
        await updateTenant.mutateAsync({ id: tenant!.id, ...payload });
      }
      reset();
      onSaved();
    } catch {
      // error handled by toast
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700"
    >
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {mode === 'create' ? 'New Tenant' : `Edit: ${tenant?.name}`}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tenant Name</label>
          <input
            {...register('name')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., Mumbai DC"
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State Code</label>
          <input
            {...register('stateCode')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., MH, KA, TN"
          />
          {errors.stateCode && <p className="mt-1 text-sm text-red-500">{errors.stateCode.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GSTIN (optional)</label>
          <input
            {...register('gstin')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., 29ABCDE1234F1Z5"
          />
          {errors.gstin && <p className="mt-1 text-sm text-red-500">{errors.gstin.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Billing Address (optional)</label>
          <input
            {...register('billingAddress')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., 123 MG Road, Bengaluru"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          disabled={isPending}
        >
          {isPending ? 'Saving...' : mode === 'create' ? 'Create Tenant' : 'Save Changes'}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-300">
          Cancel
        </button>
      </div>
    </form>
  );
}
