import { customerStore } from "./store.js";

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function executeMockTool(
  toolName: string,
  params: Record<string, any>,
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "get_customer_record": {
      const customerId = params.customerId || params.id;
      if (!customerId) {
        return {
          success: false,
          error: "Missing required parameter: customerId",
        };
      }
      const record = customerStore.get(customerId);
      if (!record) {
        return {
          success: false,
          error: `Customer record not found for ID: ${customerId}`,
        };
      }
      return { success: true, data: record };
    }

    case "update_customer_record": {
      const customerId = params.customerId || params.id;
      const fields = params.fields || params.data || {};
      if (!customerId) {
        return {
          success: false,
          error: "Missing required parameter: customerId",
        };
      }
      const updated = customerStore.update(customerId, fields);
      if (!updated) {
        return {
          success: false,
          error: `Cannot update: Customer record not found for ID: ${customerId}`,
        };
      }
      return { success: true, data: updated };
    }

    case "delete_customer_record": {
      const customerId = params.customerId || params.id;
      if (!customerId) {
        return {
          success: false,
          error: "Missing required parameter: customerId",
        };
      }
      const deleted = customerStore.delete(customerId);
      if (!deleted) {
        return {
          success: false,
          error: `Cannot delete: Customer record not found for ID: ${customerId}`,
        };
      }
      return { success: true, data: { deleted: true, customerId } };
    }

    case "send_email": {
      const { to, subject, body } = params;
      if (!to || !subject || !body) {
        return {
          success: false,
          error: "Missing required email parameters (to, subject, body)",
        };
      }
      return {
        success: true,
        data: {
          status: "queued",
          messageId: `msg_${Math.random().toString(36).substring(2, 10)}`,
          to,
          subject,
          length: body.length,
          sentAt: new Date().toISOString(),
        },
      };
    }

    case "execute_report_query": {
      const sqlLike = params.sqlLike || params.query || "";
      if (!sqlLike) {
        return {
          success: false,
          error: "Missing required query string parameter: sqlLike",
        };
      }
      // Return simulated query report results
      const customers = customerStore.getAll();
      return {
        success: true,
        data: {
          query: sqlLike,
          rowCount: customers.length,
          executionTimeMs: 14.2,
          sampleRows: customers.slice(0, 3),
        },
      };
    }

    case "export_report": {
      const dateRange = params.dateRange || "last_30_days";
      return {
        success: true,
        data: {
          reportUrl: `https://reports.internal.agentwaf/export-${Date.now()}.csv`,
          dateRange,
          format: "csv",
          generatedAt: new Date().toISOString(),
          recordCount: customerStore.getAll().length,
        },
      };
    }

    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
  }
}
