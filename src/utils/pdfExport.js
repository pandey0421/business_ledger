// src/utils/pdfExport.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportLedgerToPDF = async (pdfData, fileName) => {
  try {
    // pdfData is an object containing the PDF content to render
    const { entityName, entityType, entries, openingBalance, closingBalance, totalDebit, totalCredit, dateRange, generatedDate } = pdfData;

    // Create a temporary container for rendering
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = renderLedgerHTML(pdfData);
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    tempContainer.style.width = '210mm';
    tempContainer.style.backgroundColor = '#ffffff';
    document.body.appendChild(tempContainer);

    // Wait a bit for rendering
    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(tempContainer, {
      scale: 2,
      logging: false,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      windowHeight: tempContainer.scrollHeight,
    });

    document.body.removeChild(tempContainer);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    return true;
  } catch (error) {
    console.error('PDF generation failed:', error);
    return false;
  }
};

// ✅ FIXED: Rs. instead of ₹
export const formatIndianCurrency = (amount) => {
  return 'Rs. ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
};

// Helper function to render HTML directly
const renderLedgerHTML = (data) => {
  const { entityName, entityType, entries, openingBalance, closingBalance, totalDebit, totalCredit, dateRange, generatedDate } = data;

  const formatDate = (dateStr) => {
    return dateStr ? dateStr.replace(/-/g, '/') : '';
  };

  const getDebitLabel = () => {
    if (entityType === 'customer') return 'Sale';
    if (entityType === 'supplier') return 'Purchase';
    return 'Expense';
  };

  const getCreditLabel = () => {
    return 'Payment';
  };

  const formatCurrency = (amount) => {
    return formatIndianCurrency(Math.round(amount));
  };

  const entriesHTML = entries.map((entry, index) => {
    const isDebit = entityType === 'customer' ? entry.type === 'sale' : entityType === 'supplier' ? entry.type === 'purchase' : entry.type === 'expense';
    
    return `
      <tr style="border-bottom: 1px solid #f0f0f0; background-color: ${index % 2 === 0 ? '#fafbfc' : '#ffffff'}">
        <td style="border: 1px solid #e0e0e0; padding: 8px; text-align: left;">${formatDate(entry.date)}</td>
        <td style="border: 1px solid #e0e0e0; padding: 8px; text-align: right; color: ${isDebit ? '#2e7d32' : '#bdbdbd'}; font-weight: ${isDebit ? '600' : '400'};">
          ${isDebit ? formatCurrency(entry.amount) : '-'}
        </td>
        <td style="border: 1px solid #e0e0e0; padding: 8px; text-align: right; color: ${entry.type === 'payment' ? '#c62828' : '#bdbdbd'}; font-weight: ${entry.type === 'payment' ? '600' : '400'};">
          ${entry.type === 'payment' ? formatCurrency(entry.amount) : '-'}
        </td>
        <td style="border: 1px solid #e0e0e0; padding: 8px; text-align: right; font-weight: 600; color: ${(entry.runningBalance || entry.runningTotal || 0) >= 0 ? '#2e7d32' : '#d32f2f'};">
          ${formatCurrency(entry.runningBalance || entry.runningTotal || 0)}
        </td>
        <td style="border: 1px solid #e0e0e0; padding: 8px; text-align: left; color: #455a64;">
          ${entry.note || '-'}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: Arial, sans-serif; font-size: 11px; color: #333; padding: 25px; background-color: #ffffff; max-width: 190mm; line-height: 1.4;">
      
      <!-- HEADER -->
      <div style="text-align: center; margin-bottom: 25px; border-bottom: 3px solid #1e88e5; padding-bottom: 15px;">
        <h1 style="font-size: 24px; font-weight: bold; color: #1a237e; margin: 0 0 8px 0; text-transform: uppercase;">LEDGER REPORT</h1>
        <h2 style="font-size: 18px; font-weight: 600; color: #1976d2; margin: 0 0 5px 0;">${entityType.toUpperCase()} LEDGER</h2>
        <div style="font-size: 14px; color: #555; margin-bottom: 10px;"><strong>${entityName}</strong></div>
        <div style="font-size: 12px; color: #666;">Period: ${formatDate(dateRange.from)} ${dateRange.to ? `to ${formatDate(dateRange.to)}` : 'to date'}</div>
      </div>

      <!-- OPENING BALANCE -->
      <div style="background-color: #e3f2fd; border: 2px solid #1e88e5; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
        <div style="font-size: 14px; font-weight: 600; color: #1565c0; margin-bottom: 5px;">OPENING BALANCE (as of ${formatDate(dateRange.from)})</div>
        <div style="font-size: 22px; font-weight: bold; color: ${openingBalance >= 0 ? '#2e7d32' : '#d32f2f'}; margin: 0;">${formatCurrency(openingBalance)}</div>
      </div>

      <!-- LEDGER TABLE -->
      <div style="margin-bottom: 25px;">
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #e0e0e0; font-size: 10px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid #e0e0e0; padding: 10px 8px; text-align: left; font-weight: 600; color: #1a237e;">Date</th>
              <th style="border: 1px solid #e0e0e0; padding: 10px 8px; text-align: right; font-weight: 600; color: #2e7d32;">${getDebitLabel()}</th>
              <th style="border: 1px solid #e0e0e0; padding: 10px 8px; text-align: right; font-weight: 600; color: #c62828;">${getCreditLabel()}</th>
              <th style="border: 1px solid #e0e0e0; padding: 10px 8px; text-align: right; font-weight: 600; color: #1976d2;">Balance</th>
              <th style="border: 1px solid #e0e0e0; padding: 10px 8px; text-align: left; font-weight: 600; color: #455a64;">Particulars</th>
            </tr>
          </thead>
          <tbody>
            ${entriesHTML}
          </tbody>
        </table>
      </div>

      <!-- CLOSING BALANCE & SUMMARY -->
      <div style="border-top: 3px double #1e88e5; padding-top: 20px;">
        <div style="background-color: #fff3e0; border: 2px solid #fb8c00; border-radius: 8px; padding: 20px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="text-align: center;">
            <div style="font-size: 14px; font-weight: 600; color: #ef6c00; margin-bottom: 8px;">CLOSING BALANCE</div>
            <div style="font-size: 24px; font-weight: bold; color: ${closingBalance >= 0 ? '#2e7d32' : '#d32f2f'};">${formatCurrency(closingBalance)}</div>
          </div>
          <div>
            <table style="width: 100%; font-size: 12px;">
              <tr>
                <td style="padding: 4px 0; font-weight: 600; color: #2e7d32;">Total ${getDebitLabel()}:</td>
                <td style="padding: 4px 0; text-align: right;">${formatCurrency(totalDebit)}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-weight: 600; color: #c62828;">Total ${getCreditLabel()}:</td>
                <td style="padding: 4px 0; text-align: right;">${formatCurrency(totalCredit)}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #78909c; text-align: center;">
        <div>Generated on: ${generatedDate}</div>
        <div style="margin-top: 5px;">Page 1 of 1 | Ledger Management System</div>
      </div>

    </div>
  `;
};
