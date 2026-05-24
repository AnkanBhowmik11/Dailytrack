import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle } from "docx";
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Mobile-compatible file download function (works on Android & iOS)
async function downloadBlob(blob, fileName) {
  if (Capacitor.isNativePlatform()) {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result.split(',')[1];
        
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64data,
          directory: Directory.Documents
        });
        
        await Share.share({
          title: fileName,
          text: 'Here is the generated Invoice',
          url: savedFile.uri,
          dialogTitle: 'Save or Share Invoice'
        });
      };
    } catch (e) {
      console.error('File save error', e);
      alert('Could not save file on device');
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 1000);
  }
}

export async function generateInvoiceWord(invoiceData) {
  const {
    invoiceNo,
    orderNo,
    invoiceDate,
    clientName,
    clientAddress,
    clientState,
    clientGstin,
    companyName,
    companySubtitle,
    companyAddress,
    companyPan,
    companyGstin,
    companyBankName,
    companyBankBranch,
    companyBankAc,
    companyBankIfsc,
    particularsMonthText, // e.g. "Labour Charges for the month on Sept - 2024"
    sacCode,
    employeesList, // array of { name, amount }
    houseRentAmount,
    totalBaseAmount,
    cgstPercent,
    sgstPercent,
    igstPercent,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
    totalAmountWords
  } = invoiceData;

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: "auto" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
  };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          // TITLE
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "TAX-INVOICE", bold: true, underline: { type: "single" }, size: 28 })
            ],
            spacing: { after: 200 }
          }),

          // INVOICE TOP HEADER INFO (Invoice No, Date, etc.)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Tax Invoice No. : ", bold: true }), new TextRun({ text: invoiceNo })] }),
                      new Paragraph({ children: [new TextRun({ text: "Order No. : ", bold: true }), new TextRun({ text: orderNo || "" })] })
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Date – ", bold: true }), new TextRun({ text: invoiceDate })] })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { before: 200 } }),

          // CLIENT INFO
          new Paragraph({
            indent: { left: 720 },
            children: [
              new TextRun({ text: "M/s : ", bold: true }),
              new TextRun({ text: clientName, bold: true })
            ]
          }),
          new Paragraph({
            indent: { left: 720 },
            children: [
              new TextRun({ text: "Address : ", bold: true }),
              new TextRun({ text: clientAddress })
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        indent: { left: 720 },
                        children: [
                          new TextRun({ text: "State : ", bold: true }),
                          new TextRun({ text: clientState, bold: true })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({ text: "GSTIN : ", bold: true }),
                          new TextRun({ text: clientGstin, bold: true })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { before: 300 } }),

          // COMPANY BRANDING HEADER
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: companyName || "BHARAT ENGINEERS", bold: true, color: "228b22", size: 36 })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: companySubtitle || "ERECTION OF BOILER AND MACHINERY FABRICATION OF STRUCTURAL & PIPELINE.", bold: true, color: "0000ff", size: 20, underline: { type: "single" } })
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: companyAddress, size: 20 })
            ]
          }),
          
          new Paragraph({ spacing: { before: 100 } }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        indent: { left: 720 },
                        children: [
                          new TextRun({ text: "Pan No. : ", bold: true }),
                          new TextRun({ text: companyPan })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({ text: "GSTIN : ", bold: true }),
                          new TextRun({ text: companyGstin, bold: true })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { before: 200 } }),

          // INVOICE MAIN TABLE
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // TABLE HEADER
              new TableRow({
                children: [
                  new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SL\nNO.", bold: true })] })] }),
                  new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "QUANTITY", bold: true })] })] }),
                  new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PARTICULARS", bold: true })] })] }),
                  new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SAC\ncode", bold: true })] })] }),
                  new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "AMOUNT", bold: true })] })] }),
                ],
              }),

              // MAIN PARTICULARS ROW
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "1" })] })] }),
                  new TableCell({ children: [new Paragraph({ text: "" })] }),
                  new TableCell({
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: particularsMonthText, bold: true })], spacing: { after: 200 } }),
                      ...employeesList.map(emp => new Paragraph({ children: [new TextRun({ text: `${emp.name} - ${emp.amount}/-` })] })),
                      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: houseRentAmount > 0 ? `House Rent - ${houseRentAmount}/-` : "" })] })
                    ]
                  }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sacCode })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Rs. ${totalBaseAmount.toFixed(2)}` })] })] }),
                ]
              }),

              // SUBTOTAL
              new TableRow({
                children: [
                  new TableCell({ columnSpan: 2, children: [new Paragraph({ text: "" })] }),
                  new TableCell({ columnSpan: 2, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "AMOUNT", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Rs. ${totalBaseAmount.toFixed(2)}` })] })] }),
                ]
              }),

              // TAXES (Dynamically display SGST/CGST or IGST based on input)
              ...(cgstAmount > 0 ? [
                new TableRow({
                  children: [
                    new TableCell({ columnSpan: 2, children: [new Paragraph({ text: "" })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Add : SGST" })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${sgstPercent}%` })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Rs. ${sgstAmount.toFixed(2)}` })] })] }),
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ columnSpan: 2, children: [new Paragraph({ text: "" })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Add : CGST" })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${cgstPercent}%` })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Rs. ${cgstAmount.toFixed(2)}` })] })] }),
                  ]
                })
              ] : []),
              
              ...(igstAmount > 0 ? [
                new TableRow({
                  children: [
                    new TableCell({ columnSpan: 2, children: [new Paragraph({ text: "" })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Add : IGST" })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${igstPercent}%` })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Rs. ${igstAmount.toFixed(2)}` })] })] }),
                  ]
                })
              ] : []),

              // GRAND TOTAL
              new TableRow({
                children: [
                  new TableCell({ columnSpan: 2, children: [new Paragraph({ text: "" })] }),
                  new TableCell({ columnSpan: 2, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Total", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Rs. ${totalAmount.toFixed(2)}`, bold: true })] })] }),
                ]
              }),

              // TOTAL IN WORDS
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Rupees", bold: true })] })] }),
                  new TableCell({ columnSpan: 4, children: [new Paragraph({ children: [new TextRun({ text: totalAmountWords })] })] }),
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { before: 200 } }),

          // BANK DETAILS & TERMS
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    margins: { top: 50, bottom: 50, left: 100, right: 100 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "OUR BANKER DETAILS :- (PLEASE PAY A/C. PAYEE CHEQUE ONLY)", bold: true })] }),
                      new Paragraph({ children: [new TextRun({ text: companyBankName })] }),
                      new Paragraph({ children: [new TextRun({ text: companyBankBranch })] }),
                      new Paragraph({ children: [new TextRun({ text: `A/C. No. : ${companyBankAc}`, bold: true })] }),
                      new Paragraph({ children: [new TextRun({ text: `IFCS Code : ${companyBankIfsc}`, bold: true })] }),
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    margins: { top: 50, bottom: 50, left: 100, right: 100 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Invoice Term : ", bold: true }),
                          new TextRun({ text: "Interest will be charged at 21% p.a. if the bill is not paid on presentation." })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { before: 200 } }),

          // FOOTER SIGNATURES
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Subject to Kolkata Jurisdiction" })] })
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `For, ${companyName || "BHARAT ENGINEERS"}` })] }),
                      new Paragraph({ spacing: { before: 800 }, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Authorized signatory" })] })
                    ]
                  })
                ]
              })
            ]
          })

        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanInvoiceNo = invoiceNo.replace(/[^a-zA-Z0-9-]/g, "_") || "invoice";
  downloadBlob(blob, `Invoice_${cleanInvoiceNo}.docx`);
}
