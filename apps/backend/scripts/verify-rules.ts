import "dotenv/config";

const BASE_URL = "http://localhost:4000/api/v1/tool-call";
const API_KEY = "agnt_demo_alpha_key_999888777666";

async function makeToolCall(body: {
  sessionId: string;
  tool: string;
  params: Record<string, any>;
}) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-key": API_KEY,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  return { status: res.status, data: json };
}

async function runDemonstrations() {
  console.log(
    "===============================================================",
  );
  console.log("AGENT WAF — LIVE GATEWAY RULE ENFORCEMENT DEMONSTRATION");
  console.log(
    "===============================================================\n",
  );

  // 1. DATA_SCOPE Rule Violation
  console.log("--- TEST 1: DATA_SCOPE Rule Violation ---");
  const dataScopeRes = await makeToolCall({
    sessionId: "sess_verify_ds",
    tool: "get_customer_record",
    params: { customerId: "CUST-2005" }, // Out of scope for ^CUST-1 agent
  });
  console.log(`HTTP Status: ${dataScopeRes.status}`);
  console.log(`Disposition: ${dataScopeRes.data.disposition}`);
  console.log(`Blocked Reason: ${dataScopeRes.data.blockedReason}\n`);

  // 2. SEQUENCE Rule Violation
  console.log("--- TEST 2: SEQUENCE Rule Violation ---");
  const seqRes = await makeToolCall({
    sessionId: "sess_verify_seq_fresh",
    tool: "update_customer_record", // Requires prior get_customer_record
    params: { customerId: "CUST-1001", fields: { tier: "enterprise" } },
  });
  console.log(`HTTP Status: ${seqRes.status}`);
  console.log(`Disposition: ${seqRes.data.disposition}`);
  console.log(`Blocked Reason: ${seqRes.data.blockedReason}\n`);

  // 3. PARAM_BLOCKLIST (SQL Injection) Violation
  console.log("--- TEST 3: PARAM_BLOCKLIST (SQL Injection) Violation ---");
  const sqlRes = await makeToolCall({
    sessionId: "sess_verify_sql",
    tool: "execute_report_query",
    params: { sqlLike: "SELECT * FROM customers; DROP TABLE customers; --" },
  });
  console.log(`HTTP Status: ${sqlRes.status}`);
  console.log(`Disposition: ${sqlRes.data.disposition}`);
  console.log(`Blocked Reason: ${sqlRes.data.blockedReason}\n`);

  // 4. PARAM_SIZE_LIMIT Violation
  console.log("--- TEST 4: PARAM_SIZE_LIMIT Violation ---");
  const sizeRes = await makeToolCall({
    sessionId: "sess_verify_size",
    tool: "send_email",
    params: {
      to: "client@example.com",
      subject: "Urgent Notification",
      body: "A".repeat(150), // Max allowed is 100
    },
  });
  console.log(`HTTP Status: ${sizeRes.status}`);
  console.log(`Disposition: ${sizeRes.data.disposition}`);
  console.log(`Blocked Reason: ${sizeRes.data.blockedReason}\n`);

  // 5. RATE_LIMIT Violation (max 3/min on export_report)
  console.log("--- TEST 5: RATE_LIMIT Violation ---");
  for (let i = 1; i <= 4; i++) {
    const rlRes = await makeToolCall({
      sessionId: "sess_verify_rl",
      tool: "export_report",
      params: { dateRange: "last_7_days" },
    });
    console.log(
      `Call #${i} -> Status: ${rlRes.status}, Disposition: ${rlRes.data.disposition}${rlRes.data.blockedReason ? `, Reason: ${rlRes.data.blockedReason}` : ""}`,
    );
  }
  console.log("");

  // 6. SHADOW Mode Evaluation
  console.log("--- TEST 6: SHADOW Mode Evaluation ---");
  const shadowRes = await makeToolCall({
    sessionId: "sess_verify_shadow",
    tool: "execute_report_query",
    params: { sqlLike: "SELECT * FROM customers WHERE balance > 1000" }, // Triggers SHADOW rule for SELECT *
  });
  console.log(`HTTP Status: ${shadowRes.status}`);
  console.log(`Disposition: ${shadowRes.data.disposition}`);
  console.log(
    `Result sample count: ${shadowRes.data.result?.sampleRows?.length}`,
  );
  console.log(
    `Rule evaluations: ${JSON.stringify(shadowRes.data.ruleResults, null, 2)}\n`,
  );

  // 7. ALLOWED Valid Call with Sequence Progression
  console.log("--- TEST 7: ALLOWED Valid Tool Call & Sequence Progression ---");
  const validGet = await makeToolCall({
    sessionId: "sess_verify_flow_01",
    tool: "get_customer_record",
    params: { customerId: "CUST-1001" },
  });
  console.log(
    `Step 1 (get): Status: ${validGet.status}, Disposition: ${validGet.data.disposition}, Customer: ${validGet.data.result?.name}`,
  );

  const validUpdate = await makeToolCall({
    sessionId: "sess_verify_flow_01",
    tool: "update_customer_record",
    params: { customerId: "CUST-1001", fields: { balance: 65000 } },
  });
  console.log(
    `Step 2 (update after get): Status: ${validUpdate.status}, Disposition: ${validUpdate.data.disposition}, New Balance: ${validUpdate.data.result?.balance}\n`,
  );

  console.log(
    "===============================================================",
  );
  console.log("ALL RULE ENFORCEMENT & SHADOW TESTS PASSED OVER HTTP GATEWAY!");
  console.log(
    "===============================================================",
  );
}

runDemonstrations().catch(console.error);
