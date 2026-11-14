import time
import duckdb

t0 = time.time()
con = duckdb.connect()
rows = con.execute("""
    SELECT 
        Timestamp, "From Bank", Account, "To Bank", Account_1, "Amount Paid", "Payment Format", "Is Laundering"
    FROM read_csv('data/raw/LI-Small_Trans.csv', header=true, auto_detect=true)
    WHERE "Is Laundering" = 1
    LIMIT 20
""").fetchall()
print(f"Read {len(rows)} rows in {time.time() - t0:.2f}s")
print(rows[:2])
