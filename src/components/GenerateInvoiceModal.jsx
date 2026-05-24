import React, { useState, useEffect } from 'react';
import { generateInvoiceWord } from '../utils/generateInvoiceWord';

// Simple utility to convert a number to Indian words
function numberToWords(num) {
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];

  if ((num = num.toString()).length > 9) return 'Overflow';
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return;
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'only' : 'only';
  return str;
}

export default function GenerateInvoiceModal({ onClose, site, month, year, payrollList, settings }) {
  // Pre-fill state
  const [invoiceNo, setInvoiceNo] = useState(`BE/${month}/${year}-25`);
  const [orderNo, setOrderNo] = useState('');
  
  // Format today's date DD/MM/YYYY
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth()+1).padStart(2, '0')}/${today.getFullYear()}`;
  const [invoiceDate, setInvoiceDate] = useState(dateStr);

  const [clientName, setClientName] = useState(site ? site.name : '');
  const [clientAddress, setClientAddress] = useState('');
  const [clientState, setClientState] = useState('WEST BENGAL');
  const [clientGstin, setClientGstin] = useState('');
  
  const [sacCode, setSacCode] = useState('998717');
  
  // Particulars & Amounts
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [particularsMonthText, setParticularsMonthText] = useState(`Labour Charges for the month on ${months[month - 1]} - ${year}`);
  const [houseRentAmount, setHouseRentAmount] = useState(0);
  
  // Taxes
  const [cgstPercent, setCgstPercent] = useState(settings?.defaultGstRate ? settings.defaultGstRate / 2 : 9);
  const [sgstPercent, setSgstPercent] = useState(settings?.defaultGstRate ? settings.defaultGstRate / 2 : 9);
  const [igstPercent, setIgstPercent] = useState(0);

  // Editable Company Details
  const [companyName, setCompanyName] = useState(settings?.name || "BHARAT ENGINEERS");
  const [companySubtitle, setCompanySubtitle] = useState("ERECTION OF BOILER AND MACHINERY FABRICATION OF STRUCTURAL & PIPELINE.");
  const [companyAddress, setCompanyAddress] = useState(settings?.address || "35, Thakurpara lane, Manikpur, No. 2 airport gate, P.O. :Italgacha, Kolkata – 700079");

  const [isGenerating, setIsGenerating] = useState(false);

  // Derived calculations
  const totalBaseAmount = payrollList.reduce((acc, row) => acc + row.netSalary, 0) + Number(houseRentAmount);
  const cgstAmount = (totalBaseAmount * cgstPercent) / 100;
  const sgstAmount = (totalBaseAmount * sgstPercent) / 100;
  const igstAmount = (totalBaseAmount * igstPercent) / 100;
  
  const totalAmount = totalBaseAmount + cgstAmount + sgstAmount + igstAmount;

  const handleGenerate = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const employeesList = payrollList.map(row => ({
        name: row.employee.name,
        amount: row.netSalary
      }));

      const totalAmountRounded = Math.round(totalAmount);
      const words = numberToWords(totalAmountRounded);

      await generateInvoiceWord({
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
        companyPan: settings?.panNo,
        companyGstin: settings?.gstin,
        companyBankName: settings?.bankName,
        companyBankBranch: settings?.bankBranch,
        companyBankAc: settings?.bankAccount,
        companyBankIfsc: settings?.bankIfsc,
        particularsMonthText,
        sacCode,
        employeesList,
        houseRentAmount: Number(houseRentAmount),
        totalBaseAmount,
        cgstPercent,
        sgstPercent,
        igstPercent,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalAmount,
        totalAmountWords: words
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to generate Word document.');
    }
    setIsGenerating(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 600 }}>
      <div className="modal-sheet" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        
        <div className="modal-header">
          <span className="modal-title">Generate Word Invoice</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleGenerate} className="form-block">

            {/* Company header */}
            <div className="card card--flat">
              <div className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Your Company (Invoice Header)</div>
              <div className="form-block">
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Company Name</label>
                    <input type="text" className="input" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label className="field-label">Subtitle</label>
                    <input type="text" className="input" value={companySubtitle} onChange={e => setCompanySubtitle(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Company Address</label>
                  <input type="text" className="input" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} required />
                </div>
              </div>
            </div>

            {/* Invoice info */}
            <div className="field-row">
              <div className="field">
                <label className="field-label">Invoice No.</label>
                <input type="text" className="input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label">Invoice Date</label>
                <input type="text" className="input" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
              </div>
            </div>

            {/* Client details */}
            <div className="field-row">
              <div className="field">
                <label className="field-label">Billed To (Client)</label>
                <input type="text" className="input" value={clientName} onChange={e => setClientName(e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label">Client GSTIN</label>
                <input type="text" className="input" value={clientGstin} onChange={e => setClientGstin(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Client Address</label>
                <textarea className="input textarea" rows={2} value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Client State</label>
                <input type="text" className="input" value={clientState} onChange={e => setClientState(e.target.value)} />
              </div>
            </div>

            {/* Particulars */}
            <div className="field">
              <label className="field-label">Particulars Heading</label>
              <input type="text" className="input" value={particularsMonthText} onChange={e => setParticularsMonthText(e.target.value)} required />
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">House Rent (Optional ₹)</label>
                <input type="number" className="input" value={houseRentAmount} onChange={e => setHouseRentAmount(e.target.value)} min="0" />
              </div>
              <div className="field">
                <label className="field-label">SAC Code</label>
                <input type="text" className="input" value={sacCode} onChange={e => setSacCode(e.target.value)} required />
              </div>
            </div>

            {/* Tax */}
            <div className="field-row">
              <div className="field">
                <label className="field-label">SGST (%)</label>
                <input type="number" className="input" value={sgstPercent} onChange={e => setSgstPercent(Number(e.target.value))} min="0" step="0.1" />
              </div>
              <div className="field">
                <label className="field-label">CGST (%)</label>
                <input type="number" className="input" value={cgstPercent} onChange={e => setCgstPercent(Number(e.target.value))} min="0" step="0.1" />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">IGST (%)</label>
                <input type="number" className="input" value={igstPercent} onChange={e => setIgstPercent(Number(e.target.value))} min="0" step="0.1" />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <div className="tax-summary" style={{ marginTop: 0 }}>
                  <div className="tax-summary__total">
                    <span>Total</span>
                    <span className="tax-summary__total-val">₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--full" disabled={isGenerating} style={{ marginTop: 8 }}>
              {isGenerating ? 'Generating…' : '⬇ Download Word Document'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

