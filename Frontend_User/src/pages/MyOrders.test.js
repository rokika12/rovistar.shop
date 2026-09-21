import { mergeOrderHistory } from './MyOrders';

test('merges logged-in and guest order histories without duplicates', () => {
  const merged = mergeOrderHistory(
    {
      count: 2,
      orders: [
        { id: 1, order_number: 'A-100', created_at: '2024-02-01T10:00:00Z' },
        { id: 2, order_number: 'A-200', created_at: '2024-02-02T10:00:00Z' },
      ],
    },
    [
      { id: 2, order_number: 'A-200', created_at: '2024-02-02T10:00:00Z' },
      { id: 3, order_number: 'G-300', created_at: '2024-02-03T10:00:00Z' },
    ]
  );

  expect(merged.count).toBe(3);
  expect(merged.orders.map((o) => o.order_number)).toEqual(['G-300', 'A-200', 'A-100']);
});
