import duckdb
import pandas as pd
import numpy as np

con = duckdb.connect()
con.execute("PRAGMA threads = 8;")

# Load laundering transactions
print("[*] Finding cycle laundering rings...")
con.execute("""
    CREATE TEMP TABLE l_tx AS 
    SELECT 
        ROW_NUMBER() OVER () as tx_id,
        Timestamp as ts,
        "From Bank" || '_' || Account as src,
        "To Bank" || '_' || Account_1 as dst,
        "Amount Received" as amt_rcv,
        "Amount Paid" as amt_paid,
        "Payment Format" as payment_format,
        "Is Laundering" as is_laundering
    FROM 'data/raw/transactions.parquet'
    WHERE "Is Laundering" = 1
""")

print("Laundering tx count:", con.execute("SELECT COUNT(*) FROM l_tx").fetchone()[0])

# Find 3-hop cycles in laundering tx: A -> B -> C -> A
cycles_3 = con.execute("""
    SELECT 
        t1.src as a, t1.dst as b, t2.dst as c,
        t1.amt_paid as amt1, t2.amt_paid as amt2, t3.amt_paid as amt3,
        t1.ts as ts1, t2.ts as ts2, t3.ts as ts3,
        t1.tx_id as tx1, t2.tx_id as tx2, t3.tx_id as tx3
    FROM l_tx t1
    JOIN l_tx t2 ON t1.dst = t2.src
    JOIN l_tx t3 ON t2.dst = t3.src AND t3.dst = t1.src
    WHERE t1.src != t1.dst AND t1.dst != t2.dst AND t2.dst != t1.src
    LIMIT 10
""").df()
print("\n3-hop laundering cycles:")
print(cycles_3)

# Find 4-hop or 2-hop cycles if 3-hop is empty
if len(cycles_3) == 0:
    print("\nChecking 2-hop cycles (reciprocal):")
    cycles_2 = con.execute("""
        SELECT 
            t1.src as a, t1.dst as b,
            t1.amt_paid as amt1, t2.amt_paid as amt2,
            t1.ts as ts1, t2.ts as ts2
        FROM l_tx t1
        JOIN l_tx t2 ON t1.dst = t2.src AND t2.dst = t1.src
        LIMIT 10
    """).df()
    print(cycles_2)

# Find Gather-Scatter in laundering tx
# Central node X with multiple in-edges and multiple out-edges
print("\n[*] Finding gather-scatter laundering clusters...")
gs_nodes = con.execute("""
    WITH in_deg AS (
        SELECT dst as node, COUNT(DISTINCT src) as fan_in, COUNT(*) as in_count, SUM(amt_paid) as sum_in
        FROM l_tx GROUP BY 1
    ),
    out_deg AS (
        SELECT src as node, COUNT(DISTINCT dst) as fan_out, COUNT(*) as out_count, SUM(amt_paid) as sum_out
        FROM l_tx GROUP BY 1
    )
    SELECT i.node, i.fan_in, o.fan_out, i.sum_in, o.sum_out
    FROM in_deg i
    JOIN out_deg o ON i.node = o.node
    WHERE i.fan_in >= 2 AND o.fan_out >= 2
    ORDER BY (i.fan_in + o.fan_out) DESC
    LIMIT 10
""").df()
print("Gather-Scatter central nodes:")
print(gs_nodes)
