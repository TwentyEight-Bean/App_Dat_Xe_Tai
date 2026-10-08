import { ISmsProvider } from './types';
import { MockSmsProvider } from './mock';
import { EsmsProvider } from './esms';
import { VietGuysProvider } from './vietguys';

export * from './types';
export * from './mock';
export * from './esms';
export * from './vietguys';

let cachedProvider: ISmsProvider | null = null;

/**
 * Lấy SMS Provider tương ứng theo cấu hình biến môi trường `SMS_PROVIDER`:
 * - 'mock' (mặc định cho dev / test, 0đ) -> MockSmsProvider
 * - 'esms' -> EsmsProvider
 * - 'vietguys' -> VietGuysProvider
 */
export function getSmsProvider(): ISmsProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerType = (process.env.SMS_PROVIDER || 'mock').toLowerCase().trim();

  switch (providerType) {
    case 'esms':
      cachedProvider = new EsmsProvider();
      break;
    case 'vietguys':
      cachedProvider = new VietGuysProvider();
      break;
    case 'mock':
    default:
      cachedProvider = new MockSmsProvider();
      break;
  }

  return cachedProvider;
}
