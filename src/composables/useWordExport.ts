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
  PageOrientation,
  ShadingType
} from 'docx';
import { saveAs } from 'file-saver';
import { useExcelExport, type ExportMode } from './useExcelExport';

export function useWordExport() {
  const { generateSummary } = useExcelExport();

  // Helper to create cells with styles
  const createCell = (text: string, isHeader = false) => {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ 
            text, 
            bold: isHeader, 
            size: 20, // 10pt font
            color: isHeader ? "FFFFFF" : "000000" // White text for headers
          })],
          alignment: AlignmentType.CENTER
        })
      ],
      shading: isHeader ? {
        fill: "2E74B5", // Professional Blue Header Background
        type: ShadingType.CLEAR,
        color: "auto",
      } : undefined,
      verticalAlign: "center",
      margins: { top: 100, bottom: 100, left: 100, right: 100 }
    });
  };

  const downloadWord = async (data: any[], mode: ExportMode) => {
    const summary = generateSummary(data, mode);
    const title = mode === 'withdrawals' ? 'Withdrawals Report' : 'Cleaning Logs Report';
    
    // 1. Summary Section
    const summarySection = [
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      }),
      new Paragraph({
        text: `Generated on: ${new Date().toLocaleString()}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Total Records: ", bold: true }),
          new TextRun({ text: summary.totalCount.toString() }),
          new TextRun({ text: "\t|\t" }), // Tab separator
          new TextRun({ 
            text: mode === 'withdrawals' ? "Total Value: " : "Total Weight: ", 
            bold: true 
          }),
          new TextRun({ text: summary.totalValue.toLocaleString() })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    ];

    // 2. Define Columns (Must match Excel)
    let headers: string[] = [];
    if (mode === 'withdrawals') {
      headers = ['Date', 'Time', 'Name', 'Phone', 'Bank', 'Holder', 'Account No', 'Amount', 'Status'];
    } else {
      headers = ['Date', 'Time', 'Machine', 'Type', 'Weight', 'Operator', 'Status'];
    }

    // 3. Create Header Row
    const headerRow = new TableRow({
      children: headers.map(h => createCell(h, true)),
      tableHeader: true,
    });

    // 4. Create Data Rows
    const dataRows = data.map(item => {
      let cells = [];
      
      if (mode === 'withdrawals') {
        cells = [
          new Date(item.created_at).toLocaleDateString(),
          new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          item.users?.nickname || 'Guest',
          item.users?.phone || '-',
          item.bank_name || '-',
          item.account_holder_name || '-', // ✅ Added Holder Name
          item.account_number || '-',       // ✅ Account Number
          item.amount.toString(),
          item.status
        ];
      } else {
        cells = [
          new Date(item.cleaned_at).toLocaleDateString(),
          new Date(item.cleaned_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          item.device_no,
          item.waste_type,
          item.bag_weight_collected.toString(),
          item.cleaner_name || 'System',
          item.status
        ];
      }

      return new TableRow({
        children: cells.map(c => createCell(c))
      });
    });

    // 5. Build Table
    const table = new Table({
      rows: [headerRow, ...dataRows],
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
      }
    });

    // 6. Generate Document (Landscape)
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            // ✅ Landscape to fit all columns beautifully
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 720, // 0.5 inch
              right: 720,
              bottom: 720,
              left: 720,
            }
          },
        },
        children: [
          ...summarySection,
          table
        ],
      }],
    });

    // 7. Save
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.docx`);
  };

  return { downloadWord };
}