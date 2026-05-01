import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { ReportContent, ReportInput } from "./openai.js";

export async function buildReportDocx(
  input: ReportInput,
  content: ReportContent,
): Promise<Buffer> {
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: `${input.companyName} — Strategic Report`, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: generatedAt, italics: true })],
    }),
    new Paragraph({ text: "" }),
    metaLine("Industry", input.industry),
    metaLine("Goal", input.goal),
    metaLine("Primary Challenge", input.challenge),
    new Paragraph({ text: "" }),

    heading("Executive Summary"),
    paragraph(content.executiveSummary),

    heading("Situation Analysis"),
    paragraph(content.situationAnalysis),

    heading("Strategic Recommendations"),
    ...bulletList(content.strategicRecommendations),

    heading("Risks"),
    ...bulletList(content.risks),

    heading("Next Steps"),
    ...numberedList(content.nextSteps),
  ];

  const doc = new Document({
    creator: "phase3automations",
    title: `${input.companyName} Strategic Report`,
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true })],
  });
}

function paragraph(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)] });
}

function metaLine(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}

function bulletList(items: string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun(item)],
      }),
  );
}

function numberedList(items: string[]): Paragraph[] {
  return items.map(
    (item, idx) =>
      new Paragraph({
        children: [new TextRun(`${idx + 1}. ${item}`)],
      }),
  );
}
