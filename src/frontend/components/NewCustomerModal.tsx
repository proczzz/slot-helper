import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createTestCustomer } from '../lib/admin.ts';

export function NewCustomerModal({ onClose }: { onClose: () => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (next: { id: string; name: string }) => createTestCustomer(next.id, next.name),
    // 等清單重抓完才關閉,避免關掉後才看到新顧客冒出來
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      onClose();
    },
  });

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">新增測試顧客</h3>

        <form
          className="flex flex-col gap-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ id, name });
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend">識別碼</legend>
            <input
              type="text"
              className="input w-full"
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder="alice"
              autoFocus
            />
            <p className="label">用來區分不同測試身分，會存成 test:alice</p>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">名稱</legend>
            <input
              type="text"
              className="input w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="王小姐"
            />
          </fieldset>

          {create.isError && <div className="alert alert-error">{create.error.message}</div>}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={create.isPending || !id || !name}
            >
              {create.isPending && <span className="loading loading-spinner loading-xs" />}
              建立
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
