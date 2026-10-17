
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function generateReimbursementSummary(bill, validation) {
  if (!bill || typeof bill !== "object") {
    throw new Error("Valid bill data is required.");
  }

  const prompt = `
You are an assistant helping administrators review reimbursement claims.

Summarize the following extracted bill information clearly and concisely.

Extracted bill data:
${JSON.stringify(bill, null, 2)}

Validation results:
${JSON.stringify(validation || {}, null, 2)}

Return a response with these headings:
1. Expense Summary
2. Key Details
3. Validation Findings
4. Recommended Review Actions

Rules:
- Use only the supplied information.
- Clearly identify missing fields and validation warnings.
- Do not invent facts or claim the bill is authentic.
- Do not make the final approval or rejection decision.
- If information is missing, explicitly say so.
- Keep the response concise and professional.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
  });

  const summary = response.text;

  if (!summary) {
    throw new Error("The AI did not return a summary.");
  }

  return summary;
}

module.exports = { generateReimbursementSummary };
