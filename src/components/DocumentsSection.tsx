import React from 'react';
import DocumentUpload from './DocumentUpload';

interface Document {
  name: string;
  url: string;
  type: string;
  path: string;
}

interface DocumentsSectionProps {
  type: 'PF' | 'PJ';
  userId: string;
  documents: Record<string, Document>;
  onDocumentChange: (type: string, doc: Document | undefined) => void;
  onError?: (error: string) => void;
}

export default function DocumentsSection({
  type,
  userId,
  documents,
  onDocumentChange,
  onError
}: DocumentsSectionProps) {
  const pfDocuments = [
    { type: 'rg', label: 'RG' },
    { type: 'address_proof', label: 'Comprovante de Endereço' },
    { type: 'income_tax_declaration', label: 'Declaração de Imposto de Renda' },
    { type: 'income_tax_receipt', label: 'Recibo de Entrega do Imposto de Renda' },
    { type: 'marital_status', label: 'Certidão de Estado Civil' },
  ];

  const pjDocuments = [
    { type: 'social_contract', label: 'Contrato Social' },
    { type: 'revenue_12months', label: 'Faturamento dos últimos 12 meses' },
    { type: 'balance_sheet', label: 'Balanço Patrimonial' },
    { type: 'partner_document', label: 'Documento do Sócio' },
  ];

  const documentsList = type === 'PF' ? pfDocuments : pjDocuments;

  return (
    <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Documentos
        </h2>
        <p className="text-sm text-gray-400">
          Faça o upload dos documentos necessários para análise do seu cadastro.
          Os documentos não são obrigatórios neste momento, mas são essenciais para a análise de crédito.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {documentsList.map((doc) => (
          <DocumentUpload
            key={doc.type}
            label={doc.label}
            type={doc.type}
            userId={userId}
            value={documents[doc.type]}
            onChange={(newDoc) => onDocumentChange(doc.type, newDoc)}
            onError={onError}
          />
        ))}
      </div>
    </div>
  );
}