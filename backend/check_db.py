import sqlite3

conn = sqlite3.connect('app/agrichain.db')
c = conn.cursor()

c.execute('SELECT status, count(*) FROM shop_orders GROUP BY status')
print('Order statuses:', c.fetchall())

c.execute('SELECT count(*) FROM shop_orders')
print('Total orders:', c.fetchall())

c.execute("SELECT count(*), sum(final_amount) FROM shop_orders WHERE status IN ('completed', 'dispatched')")
print('Sold orders (count, revenue):', c.fetchall())

c.execute("SELECT category, count(*), sum(amount) FROM shop_accounting_expenses GROUP BY category")
print('Expenses by category:', c.fetchall())

# Check if there are order items with product cost info
c.execute("""
SELECT soi.product_name, soi.quantity, soi.subtotal, p.cost_price, p.apportioned_transport, p.apportioned_labour, p.apportioned_other, so.status
FROM shop_order_items soi
JOIN shop_orders so ON so.id = soi.order_id
LEFT JOIN product p ON p.id = soi.product_id
LIMIT 20
""")
print('\nOrder items with costs:')
for row in c.fetchall():
    print(f'  {row}')

# Check product details
c.execute("SELECT id, name, batch_number, cost_price, price, quantity, status FROM product LIMIT 20")
print('\nProducts:')
for row in c.fetchall():
    print(f'  {row}')

conn.close()
