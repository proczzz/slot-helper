import { customerDisplayName, type Customer } from '../lib/admin.ts';
import { ChannelMark } from './BrandMark.tsx';

// 頭像右下角掛管道標記。沒有頭像的就顯示名字首字,
// 不拿管道的 logo 當頭像 —— 那看起來像在跟 app 對話而不是跟人
export function CustomerAvatar({
  customer,
  className = 'size-9',
}: {
  customer: Customer;
  className?: string;
}) {
  const initial = customerDisplayName(customer).trim().charAt(0).toUpperCase();

  return (
    <div className="relative shrink-0">
      <div className="avatar avatar-placeholder">
        <div className={`${className} rounded-full bg-base-300 text-base-content/70`}>
          {customer.pictureUrl ? (
            <img
              src={customer.pictureUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium">{initial}</span>
          )}
        </div>
      </div>

      <span className="absolute -right-0.5 -bottom-0.5 grid place-items-center">
        <ChannelMark channel={customer.channel} className="size-4" />
      </span>
    </div>
  );
}
