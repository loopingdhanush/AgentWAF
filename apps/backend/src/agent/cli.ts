import { runAgentGoal } from "./runner.js";

async function main() {
  const goal =
    process.argv.slice(2).join(" ") ||
    "Please fetch customer record for CUST-1001, then update their balance to 72000, and send a summary email.";

  console.log(
    "===============================================================",
  );
  console.log("AGENT WAF — GEMINI AGENT RUNNER (CLI)");
  console.log(
    "===============================================================",
  );
  console.log(`Goal: "${goal}"\n`);

  try {
    const result = await runAgentGoal({
      goal,
      onStep: (step) => {
        if (step.toolCall) {
          console.log(
            `[Step ${step.stepIndex}] Tool Call: ${step.toolCall.tool}`,
          );
          console.log(`  Params: ${JSON.stringify(step.toolCall.params)}`);
          if (step.wafResponse) {
            console.log(`  WAF Disposition: ${step.wafResponse.disposition}`);
            if (step.wafResponse.blockedReason) {
              console.log(
                `  Blocked Reason: ${step.wafResponse.blockedReason}`,
              );
            } else if (step.wafResponse.result) {
              console.log(
                `  Result: ${JSON.stringify(step.wafResponse.result)}`,
              );
            }
          }
          console.log("");
        } else if (step.modelThought) {
          console.log(`[Step ${step.stepIndex}] Model Final Conclusion:`);
          console.log(`  ${step.modelThought}\n`);
        }
      },
    });

    console.log(
      "---------------------------------------------------------------",
    );
    console.log("EXECUTION SUMMARY:");
    console.log(`Total Steps: ${result.totalSteps}`);
    console.log(`Total Blocks: ${result.totalBlocks}`);
    console.log(`Final Model Response:\n${result.finalAnswer}`);
    console.log(
      "===============================================================\n",
    );
  } catch (err: any) {
    console.error(`\nExecution Error: ${err.message}`);
    process.exit(1);
  }
}

main();
