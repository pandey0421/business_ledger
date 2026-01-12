// src/components/LedgerPDFTemplate.jsx
import React from 'react';
import { formatIndianCurrency } from '../utils/pdfExport';

const LedgerPDFTemplate = ({
  entityName,
  entityType, // 'customer', 'supplier', 'expense'
  entries,
  openingBalance,
  closingBalance,
  totalDebit, // sales/purchase/expenses
  totalCredit, // payments
  dateRange, // { from, to }
  generatedDate
}) => {
  const formatDate = (dateStr) => {
    // Input: "2082-07-15" → Output: "2082/07/15" for display
    return dateStr ? dateStr.replace(/-/g, '/') : '';
  };

  const getTypeLabel = (type) => {
    if (entityType === 'customer') {
      return type === 'sale' ? 'Sale' : 'Payment';
    } else if (entityType === 'supplier') {
      return type === 'purchase' ? 'Purchase' : 'Payment';
    }
    return 'Expense';
  };

  const getDebitLabel = () => {
    if (entityType === 'customer') return 'Sale';
    if (entityType === 'supplier') return 'Purchase';
    return 'Expense';
  };

  const getCreditLabel = () => {
    return 'Payment';
  };

  return (
    <div
      id="ledger-pdf-content"
      style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: '#333',
        padding: '25px',
        backgroundColor: '#ffffff',
        maxWidth: '190mm',
        lineHeight: 1.4,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact'
      }}
    >
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '25px', borderBottom: '3px solid #1e88e5', paddingBottom: '15px' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1a237e',
          margin: '0 0 8px 0',
          textTransform: 'uppercase'
        }}>
          LEDGER REPORT
        </h1>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1976d2',
          margin: '0 0 5px 0'
        }}>
          {entityType.toUpperCase()} LEDGER
        </h2>
        <div style={{ fontSize: '14px', color: '#555', marginBottom: '10px' }}>
          <strong>{entityName}</strong>
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          Period: {formatDate(dateRange.from)} {dateRange.to ? `to ${formatDate(dateRange.to)}` : 'to date'}
        </div>
      </div>

      {/* OPENING BALANCE */}
      <div style={{
        backgroundColor: '#e3f2fd',
        border: '2px solid #1e88e5',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1565c0', marginBottom: '5px' }}>
          OPENING BALANCE (as of {formatDate(dateRange.from)})
        </div>
        <div style={{
          fontSize: '22px',
          fontWeight: 'bold',
          color: openingBalance >= 0 ? '#2e7d32' : '#d32f2f',
          margin: '0'
        }}>
          {formatIndianCurrency(openingBalance)}
        </div>
      </div>

      {/* LEDGER TABLE */}
      <div style={{ marginBottom: '25px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '2px solid #e0e0e0',
            fontSize: '10px'
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{
                border: '1px solid #e0e0e0',
                padding: '10px 8px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#1a237e'
              }}>
                Date
              </th>
              <th style={{
                border: '1px solid #e0e0e0',
                padding: '10px 8px',
                textAlign: 'right',
                fontWeight: '600',
                color: '#2e7d32'
              }}>
                {getDebitLabel()}
              </th>
              <th style={{
                border: '1px solid #e0e0e0',
                padding: '10px 8px',
                textAlign: 'right',
                fontWeight: '600',
                color: '#c62828'
              }}>
                {getCreditLabel()}
              </th>
              <th style={{
                border: '1px solid #e0e0e0',
                padding: '10px 8px',
                textAlign: 'right',
                fontWeight: '600',
                color: '#1976d2'
              }}>
                Balance
              </th>
              <th style={{
                border: '1px solid #e0e0e0',
                padding: '10px 8px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#455a64'
              }}>
                Particulars
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr
                key={entry.id || index}
                style={{
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: index % 2 === 0 ? '#fafbfc' : '#ffffff'
                }}
              >
                <td style={{ border: '1px solid #e0e0e0', padding: '8px' }}>
                  {formatDate(entry.date)}
                </td>
                <td style={{
                  border: '1px solid #e0e0e0',
                  padding: '8px',
                  textAlign: 'right',
                  color: entry.type === (entityType === 'customer' ? 'sale' : entityType === 'supplier' ? 'purchase' : 'expense') ? '#2e7d32' : '#bdbdbd',
                  fontWeight: entry.type === (entityType === 'customer' ? 'sale' : entityType === 'supplier' ? 'purchase' : 'expense') ? '600' : '400'
                }}>
                  {entry.type === (entityType === 'customer' ? 'sale' : entityType === 'supplier' ? 'purchase' : 'expense')
                    ? formatIndianCurrency(entry.amount)
                    : '-'
                  }
                </td>
                <td style={{
                  border: '1px solid #e0e0e0',
                  padding: '8px',
                  textAlign: 'right',
                  color: entry.type === 'payment' ? '#c62828' : '#bdbdbd',
                  fontWeight: entry.type === 'payment' ? '600' : '400'
                }}>
                  {entry.type === 'payment'
                    ? formatIndianCurrency(entry.amount)
                    : '-'
                  }
                </td>
                <td style={{
                  border: '1px solid #e0e0e0',
                  padding: '8px',
                  textAlign: 'right',
                  fontWeight: '600',
                  color: entry.runningBalance >= 0 ? '#2e7d32' : '#d32f2f'
                }}>
                  {formatIndianCurrency(entry.runningBalance || entry.runningTotal || 0)}
                </td>
                <td style={{
                  border: '1px solid #e0e0e0',
                  padding: '8px',
                  color: '#455a64'
                }}>
                  {entry.pN ? (
                    <div>
                      <strong>{entry.pN}</strong>
                      <div style={{ fontSize: '9px', color: '#666' }}>
                        {entry.q} {entry.u} @ {entry.r ? entry.r.toLocaleString('en-IN') : '-'}
                      </div>
                    </div>
                  ) : (
                    entry.note || '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CLOSING BALANCE & SUMMARY */}
      <div style={{ borderTop: '3px double #1e88e5', paddingTop: '20px' }}>
        <div style={{
          backgroundColor: '#fff3e0',
          border: '2px solid #fb8c00',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#ef6c00', marginBottom: '8px' }}>
              CLOSING BALANCE
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: closingBalance >= 0 ? '#2e7d32' : '#d32f2f'
            }}>
              {formatIndianCurrency(closingBalance)}
            </div>
          </div>
          <div>
            <table style={{ width: '100%', fontSize: '12px' }}>
              <tr>
                <td style={{ padding: '4px 0', fontWeight: '600', color: '#2e7d32' }}>
                  Total {getDebitLabel()}:
                </td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>
                  {formatIndianCurrency(totalDebit)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', fontWeight: '600', color: '#c62828' }}>
                  Total {getCreditLabel()}:
                </td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>
                  {formatIndianCurrency(totalCredit)}
                </td>
              </tr>
            </table>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        marginTop: '30px',
        paddingTop: '15px',
        borderTop: '1px solid #e0e0e0',
        fontSize: '10px',
        color: '#78909c',
        textAlign: 'center'
      }}>
        <div>Generated on: {generatedDate}</div>
        <div style={{ marginTop: '5px' }}>Page 1 of 1 | Ledger Management System</div>
      </div>
    </div>
  );
};

export default LedgerPDFTemplate;
