export interface JSendBody<T = unknown> {
  status: 'success' | 'fail' | 'error';
  data?: T;
  message?: string;
}

export const jsend = {
  success<T>(data: T): JSendBody<T> {
    return { status: 'success', data };
  },
  fail<T>(data: T): JSendBody<T> {
    return { status: 'fail', data };
  },
  error(message: string): JSendBody {
    return { status: 'error', message };
  },
};
