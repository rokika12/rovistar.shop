import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import TelegramSettings from './TelegramSettings';
import { getTelegramSettings, testTelegram, updateShop } from '../api';

jest.mock('../api', () => ({
  getTelegramSettings: jest.fn(),
  resolveTelegramUsername: jest.fn(),
  setTelegramWebhook: jest.fn(),
  testTelegram: jest.fn(),
  updateShop: jest.fn(),
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { shop_id: 7 } }),
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

describe('TelegramSettings', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    getTelegramSettings.mockResolvedValue({
      chat_id: '101',
      admin_chat_ids: ['202'],
      enabled: true,
      bot_token_configured: true,
      profile_id: 'PROFILE',
      secret_key: 'SECRET',
      linked_chats: [],
      bot_username: 'shop_bot',
    });
    updateShop.mockResolvedValue({ ok: true });
    testTelegram.mockResolvedValue({
      ok: true,
      detail: 'Notification sent to all recipients',
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it('saves the optional second admin chat ID before sending a test', async () => {
    await act(async () => {
      root.render(<TelegramSettings />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Admin 2 chat ID');
    expect(container.querySelector('input[placeholder="-1001234567890"]').value).toBe('101');
    expect(container.querySelector('input[placeholder="Optional second admin chat ID"]').value).toBe('202');

    const saveButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Test'));
    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(updateShop).toHaveBeenCalledWith(7, { telegram_settings: {
      bot_token: '', chat_id: '101', admin_chat_ids: ['202'], enabled: true,
    } });
    expect(testTelegram).toHaveBeenCalledWith({
      shop_id: 7, message: '🧪 Test notification from Mini Shop Platform',
    });
  });
});
