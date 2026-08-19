export function getNestedValue(obj: Record<string, any>, path: string): any {
  if (!obj || !path) return undefined;

  // If exact key exists at root
  if (path in obj) return obj[path];

  // Try dot-notation path
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

export function sanitizeParams(
  params: Record<string, any>,
  matchedPatterns: string[] = [],
): Record<string, any> {
  if (!params || typeof params !== "object") return {};

  const sanitizeValue = (val: any): any => {
    if (typeof val === "string") {
      let result = val;

      // Check if value matches any blocklist regex to redact
      for (const pattern of matchedPatterns) {
        try {
          const regex = new RegExp(pattern, "gi");
          if (regex.test(result)) {
            result = result.replace(regex, "[REDACTED]");
          }
        } catch {
          // ignore regex errors
        }
      }

      // Truncate strings > 200 chars
      if (result.length > 200) {
        result = result.substring(0, 197) + "...";
      }

      return result;
    }

    if (Array.isArray(val)) {
      return val.map(sanitizeValue);
    }

    if (val && typeof val === "object") {
      const sanitizedObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        sanitizedObj[k] = sanitizeValue(v);
      }
      return sanitizedObj;
    }

    return val;
  };

  return sanitizeValue(params);
}
