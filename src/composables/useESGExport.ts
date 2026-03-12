import { 
  Document, 
  Packer, 
  Paragraph, 
  Table, 
  TableCell, 
  TableRow, 
  WidthType, 
  HeadingLevel, 
  TextRun, 
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ShadingType
} from 'docx';
import { saveAs } from 'file-saver';
import { calculateImpact } from '../utils/esgFormulas';

export function useESGExport() {

  // CONSTANTS
  const PRIMARY_COLOR = "1E3A8A"; // Deep Blue
  const ACCENT_COLOR = "10B981"; // Emerald Green
  const WARN_COLOR = "F59E0B"; // Amber (for UCO)
  const INFO_COLOR = "3B82F6"; // Blue (for Paper)
  const LIGHT_GREY = "F8FAFC";
  const FONT_FACE = "Segoe UI"; // Modern Font (Global Standard)

  // Helper: Create a styled cell with enforced font
  const createCell = (
    text: string | number, 
    bold = false, 
    align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT, 
    fill = "FFFFFF", 
    color = "000000",
    size = 22 // 11pt default
  ) => {
    return new TableCell({
      children: [new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text), bold, color, size, font: FONT_FACE })]
      })],
      shading: { fill, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 120, bottom: 120, left: 120, right: 120 },
      verticalAlign: "center"
    });
  };

  // Helper: Create a "Visual Bar" cell
  const createBarCell = (percentage: number, color: string) => {
    return new TableCell({
      children: [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: percentage, type: WidthType.PERCENTAGE },
                  shading: { fill: color, type: ShadingType.CLEAR, color: "auto" },
                  children: [new Paragraph({})], 
                }),
                new TableCell({
                  width: { size: 100 - percentage, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({})],
                })
              ]
            })
          ],
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "auto" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
            left: { style: BorderStyle.NONE, size: 0, color: "auto" },
            right: { style: BorderStyle.NONE, size: 0, color: "auto" },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
          }
        })
      ]
    });
  };

  const generateReport = async (
    stats: { 
      weight: number; 
      users: number; 
      points: number; 
      machines: number; 
      collections: number 
    }, 
    dateRangeStr: string,
    merchantName: string = "RVM Merchant"
  ) => {
    
    const impact = calculateImpact(stats.weight);

    // --- 1. COVER PAGE ---
    const coverSection = [
        new Paragraph({
            text: "ESG & SUSTAINABILITY REPORT",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { before: 3000, after: 400 },
            run: { font: FONT_FACE, bold: true, color: PRIMARY_COLOR, size: 32 }
        }),
        new Paragraph({
            text: `Generated for: ${merchantName}`,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            run: { font: FONT_FACE, size: 28 }
        }),
        new Paragraph({
            text: `Reporting Period: ${dateRangeStr}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 2000 },
            run: { font: FONT_FACE, italics: true, color: "64748B", size: 24 }
        }),
        
        // Executive KPI Box
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        createCell("TOTAL WASTE DIVERTED", true, AlignmentType.CENTER, PRIMARY_COLOR, "FFFFFF", 28),
                        createCell("CO2 AVOIDED", true, AlignmentType.CENTER, ACCENT_COLOR, "FFFFFF", 28),
                    ]
                }),
                new TableRow({
                    children: [
                        createCell(`${stats.weight.toLocaleString()} kg`, true, AlignmentType.CENTER, "FFFFFF", "000000", 48), 
                        createCell(`${impact.totalCo2.toLocaleString(undefined, {maximumFractionDigits: 1})} kg`, true, AlignmentType.CENTER, "FFFFFF", "000000", 48),
                    ]
                }),
                new TableRow({
                    children: [
                        createCell("100% Landfill Diversion", false, AlignmentType.CENTER, LIGHT_GREY),
                        createCell(`~${Math.ceil(impact.treesEquivalent)} Trees Planted Equivalent`, false, AlignmentType.CENTER, LIGHT_GREY),
                    ]
                })
            ],
        }),
        new Paragraph({ text: "", spacing: { after: 800 } }),
    ];

    // --- 2. MATERIAL BREAKDOWN & IMPACT ---
    const breakdownHeader = new Paragraph({
        text: "Material Impact Breakdown",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 800, after: 400 },
        keepNext: true, // ✅ FIX: Forces this header to stay on the same page as the table
        run: { font: FONT_FACE, color: PRIMARY_COLOR, bold: true, size: 28 }
    });

    const breakdownTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.NONE, size: 0, color: "000000" },
            right: { style: BorderStyle.NONE, size: 0, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "000000" },
        },
        rows: [
            new TableRow({
                children: [
                    createCell("Material Category", true, AlignmentType.LEFT, LIGHT_GREY),
                    createCell("Weight (kg)", true, AlignmentType.RIGHT, LIGHT_GREY),
                    createCell("CO2 Saved (kg)", true, AlignmentType.RIGHT, LIGHT_GREY),
                    createCell("Contribution", true, AlignmentType.LEFT, LIGHT_GREY),
                ]
            }),
            new TableRow({
                children: [
                    createCell("Plastic (PET)"),
                    createCell(impact.breakdown.plastic.weight.toFixed(1), false, AlignmentType.RIGHT),
                    createCell(impact.breakdown.plastic.co2.toFixed(1), false, AlignmentType.RIGHT),
                    createBarCell(60, PRIMARY_COLOR) 
                ]
            }),
            new TableRow({
                children: [
                    createCell("Aluminum / Metal"),
                    createCell(impact.breakdown.aluminum.weight.toFixed(1), false, AlignmentType.RIGHT),
                    createCell(impact.breakdown.aluminum.co2.toFixed(1), false, AlignmentType.RIGHT),
                    createBarCell(20, ACCENT_COLOR) 
                ]
            }),
            new TableRow({
                children: [
                    createCell("Paper / Cardboard"),
                    createCell(impact.breakdown.paper.weight.toFixed(1), false, AlignmentType.RIGHT),
                    createCell(impact.breakdown.paper.co2.toFixed(1), false, AlignmentType.RIGHT),
                    createBarCell(10, INFO_COLOR) 
                ]
            }),
            new TableRow({
                children: [
                    createCell("Used Cooking Oil (UCO)"),
                    createCell(impact.breakdown.uco.weight.toFixed(1), false, AlignmentType.RIGHT),
                    createCell(impact.breakdown.uco.co2.toFixed(1), false, AlignmentType.RIGHT),
                    createBarCell(10, WARN_COLOR) 
                ]
            })
        ]
    });

    // --- 3. DETAILED METRICS ---
    const detailsHeader = new Paragraph({
        text: "Detailed Impact Analysis",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 800, after: 400 },
        keepNext: true, // ✅ FIX: Keeps header with the detailed metrics table
        run: { font: FONT_FACE, color: PRIMARY_COLOR, bold: true, size: 28 }
    });

    const metricsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.NONE, size: 0, color: "000000" },
            right: { style: BorderStyle.NONE, size: 0, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "000000" },
        },
        rows: [
            new TableRow({
                children: [
                    createCell("Metric Category", true, AlignmentType.LEFT, LIGHT_GREY),
                    createCell("Value", true, AlignmentType.RIGHT, LIGHT_GREY),
                    createCell("Unit", true, AlignmentType.LEFT, LIGHT_GREY),
                ]
            }),
            new TableRow({ children: [createCell("Total Weight Collected"), createCell(stats.weight.toLocaleString(), true, AlignmentType.RIGHT), createCell("kg")] }),
            new TableRow({ children: [createCell("Carbon Emissions Avoided"), createCell(impact.totalCo2.toFixed(2), true, AlignmentType.RIGHT), createCell("kg CO2e")] }),
            new TableRow({ children: [createCell("Energy Savings"), createCell(impact.totalEnergy.toFixed(2), true, AlignmentType.RIGHT), createCell("kWh")] }),
            new TableRow({ children: [createCell("Active Participants"), createCell(stats.users.toLocaleString(), true, AlignmentType.RIGHT), createCell("Users")] }),
            new TableRow({ children: [createCell("Avg. Recycling per User"), createCell((stats.weight / (stats.users || 1)).toFixed(2), true, AlignmentType.RIGHT), createCell("kg/User")] }),
            new TableRow({ children: [createCell("Community Wealth Distributed"), createCell(stats.points.toLocaleString(), true, AlignmentType.RIGHT), createCell("Points")] }),
            new TableRow({ children: [createCell("Collection Events (Traceability)"), createCell(stats.collections.toLocaleString(), true, AlignmentType.RIGHT), createCell("Logs")] }),
        ]
    });

    // --- 4. S & G NARRATIVE ---
    const socialHeader = new Paragraph({
        text: "Social & Governance (S & G)",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 800, after: 300 },
        keepNext: true, // FIX: Keeps header with the narrative section
        run: { font: FONT_FACE, color: PRIMARY_COLOR, bold: true, size: 28 }
    });

    const sgTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "auto" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
            left: { style: BorderStyle.NONE, size: 0, color: "auto" },
            right: { style: BorderStyle.NONE, size: 0, color: "auto" },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
        },
        rows: [
            new TableRow({
                children: [
                    createCell("COMMUNITY ENGAGEMENT", true, AlignmentType.CENTER, LIGHT_GREY, PRIMARY_COLOR),
                    createCell("DATA INTEGRITY", true, AlignmentType.CENTER, LIGHT_GREY, ACCENT_COLOR),
                ]
            }),
            new TableRow({
                children: [
                    createCell(`Engaged ${stats.users} unique individuals in green activities, fostering a culture of sustainability.`, false, AlignmentType.JUSTIFIED),
                    createCell(`Maintained full traceability through ${stats.collections} recorded digital collection logs, ensuring 100% audit compliance.`, false, AlignmentType.JUSTIFIED),
                ]
            })
        ]
    });

    // --- BUILD DOC ---
    const doc = new Document({
        // Set Global Default Font
        styles: {
            default: {
                document: {
                    run: {
                        font: FONT_FACE,
                        size: 24, // 12pt default
                        color: "333333"
                    },
                    paragraph: {
                        spacing: { line: 276, before: 120, after: 120 }, // 1.15 spacing
                    }
                },
                heading1: {
                    run: {
                        font: FONT_FACE,
                        size: 32, // 16pt
                        bold: true,
                        color: PRIMARY_COLOR,
                    },
                    paragraph: {
                        spacing: { before: 240, after: 120 },
                    },
                },
                heading2: {
                    run: {
                        font: FONT_FACE,
                        size: 28, // 14pt
                        bold: true,
                        color: "475569",
                    },
                    paragraph: {
                        spacing: { before: 240, after: 120 },
                    },
                },
            },
        },
        sections: [{
            properties: {},
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            text: "Confidential - RVM Intelligence Platform",
                            alignment: AlignmentType.RIGHT,
                            run: { color: "94A3B8", font: FONT_FACE, size: 16 }
                        })
                    ]
                })
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "Page ", font: FONT_FACE }),
                                new TextRun({ children: [PageNumber.CURRENT], font: FONT_FACE }),
                                new TextRun({ text: " of ", font: FONT_FACE }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT_FACE }),
                            ],
                        })
                    ]
                })
            },
            children: [
                ...coverSection,
                breakdownHeader,
                breakdownTable,
                detailsHeader,
                metricsTable,
                socialHeader,
                sgTable
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `ESG_Report_${new Date().toISOString().split('T')[0]}.docx`);
  };

  return { generateReport };
}