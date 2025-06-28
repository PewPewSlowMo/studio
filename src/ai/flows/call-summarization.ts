// This is a server action.
'use server';
/**
 * @fileOverview An AI agent that categorizes call recordings based on keywords and sentiment.
 *
 * - summarizeCall - A function that handles the call summarization process.
 * - SummarizeCallInput - The input type for the summarizeCall function.
 * - SummarizeCallOutput - The return type for the summarizeCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeCallInputSchema = z.object({
  recordingDataUri: z
    .string()
    .describe(
      "A call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  transcript: z.string().describe('The transcript of the call recording.'),
});
export type SummarizeCallInput = z.infer<typeof SummarizeCallInputSchema>;

const SummarizeCallOutputSchema = z.object({
  categories: z
    .array(z.string())
    .describe(
      'An array of strings for the main topics of the call (e.g., "Billing Inquiry", "Technical Support", "Complaint").'
    ),
  sentiment: z
    .string()
    .describe(
      'The overall sentiment of the call. Must be one of: "Positive", "Negative", or "Neutral".'
    ),
  summary: z
    .string()
    .describe(
      'A concise, one-paragraph summary of the call, including key points and the outcome.'
    ),
});
export type SummarizeCallOutput = z.infer<typeof SummarizeCallOutputSchema>;

export async function summarizeCall(input: SummarizeCallInput): Promise<SummarizeCallOutput> {
  return summarizeCallFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCallPrompt',
  input: {schema: SummarizeCallInputSchema},
  output: {schema: SummarizeCallOutputSchema},
  prompt: `You are an AI expert in call center quality assurance.

Your task is to analyze the provided call transcript and recording to generate a structured analysis.

Based on the content of the call, you must:
1.  **Categorize the call**: Identify the main topics or reasons for the call.
2.  **Determine the sentiment**: Analyze the overall sentiment of the conversation.
3.  **Create a summary**: Write a concise summary of the call, capturing the key points and the final outcome.

Please use the following information for your analysis.

Transcript: {{{transcript}}}
Recording: {{media url=recordingDataUri}}`,
});

const summarizeCallFlow = ai.defineFlow(
  {
    name: 'summarizeCallFlow',
    inputSchema: SummarizeCallInputSchema,
    outputSchema: SummarizeCallOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
