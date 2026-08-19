export const WAF_FUNCTION_DECLARATIONS = [
  {
    name: "get_customer_record",
    description:
      "Retrieves customer profile, contact information, subscription tier, and current account balance by customerId (e.g. CUST-1001).",
    parameters: {
      type: "OBJECT",
      properties: {
        customerId: {
          type: "STRING",
          description: "The unique customer ID (e.g. CUST-1001, CUST-1002).",
        },
      },
      required: ["customerId"],
    },
  },
  {
    name: "update_customer_record",
    description:
      "Updates fields on an existing customer record (e.g. name, tier, balance, status). Note: Customer must be looked up with get_customer_record first.",
    parameters: {
      type: "OBJECT",
      properties: {
        customerId: {
          type: "STRING",
          description: "The unique customer ID to update.",
        },
        fields: {
          type: "OBJECT",
          description:
            "Key-value map of fields to update, such as { balance: 5000, status: 'active', tier: 'enterprise' }.",
        },
      },
      required: ["customerId", "fields"],
    },
  },
  {
    name: "delete_customer_record",
    description:
      "Permanently deletes a customer record from the system. Requires prior update_customer_record confirmation in the same session.",
    parameters: {
      type: "OBJECT",
      properties: {
        customerId: {
          type: "STRING",
          description: "The customer ID to delete.",
        },
      },
      required: ["customerId"],
    },
  },
  {
    name: "send_email",
    description:
      "Sends an email to a recipient address. Max body length is strictly enforced by corporate security policies.",
    parameters: {
      type: "OBJECT",
      properties: {
        to: {
          type: "STRING",
          description: "Recipient email address.",
        },
        subject: {
          type: "STRING",
          description: "Email subject line.",
        },
        body: {
          type: "STRING",
          description: "Email message text body (keep concise).",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "execute_report_query",
    description:
      "Executes a SQL-like analytical query string against the reporting dataset.",
    parameters: {
      type: "OBJECT",
      properties: {
        sqlLike: {
          type: "STRING",
          description:
            "The SQL-like query string to execute (e.g. SELECT name, tier FROM customers).",
        },
      },
      required: ["sqlLike"],
    },
  },
  {
    name: "export_report",
    description:
      "Generates and exports an analytical dataset report URL for a specified date range. Subject to per-minute rate limits.",
    parameters: {
      type: "OBJECT",
      properties: {
        dateRange: {
          type: "STRING",
          description:
            "Date range descriptor (e.g. last_7_days, last_30_days, ytd).",
        },
      },
      required: ["dateRange"],
    },
  },
];
