import React, { useState } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Document {
  name: string;
  url: string;
  type: string;
  path: string;
  id?: string; // ID do documento no Firestore
}

interface DocumentUploadProps {
  label: string;
  type: string;
  userId: string;
  document?: Document;
  onChange: (document: Document) => void;
  onError?: (error: string | null) => void;
}

const LocalDocumentUpload: React.FC<DocumentUploadProps> = ({
  label,
  type,
  userId,
  document,
  onChange,
  onError
}) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      onError?.('O arquivo deve ter no máximo 10MB');
      return;
    }

    // Check file type
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      onError?.('Apenas arquivos PDF, JPEG e PNG são permitidos');
      return;
    }

    try {
      setUploading(true);
      console.log('Processando arquivo:', file.name);

      // Converter o arquivo para base64 para armazenamento persistente
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          // Criar um caminho simulado
          const timestamp = Date.now();
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const path = `documents/${userId}/${type}/${timestamp}_${sanitizedFileName}`;
          
          if (reader.result) {
            // Salvar o documento em uma coleção separada
            const docData = {
              name: file.name,
              url: reader.result as string,
              type,
              path,
              userId,
              createdAt: serverTimestamp()
            };
            
            const docRef = await addDoc(collection(db, 'document_files'), docData);
            
            // Retornar apenas a referência ao documento, não o conteúdo completo
            onChange({
              id: docRef.id,
              name: file.name,
              url: `document_ref:${docRef.id}`, // Usamos um prefixo para identificar que é uma referência
              type,
              path
            });
            
            console.log('Arquivo processado com sucesso, ID:', docRef.id);
          }
        } catch (error) {
          console.error('Erro ao salvar documento:', error);
          onError?.('Erro ao salvar o documento');
        } finally {
          setUploading(false);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Erro ao processar o arquivo:', error);
        onError?.('Erro ao processar o arquivo');
        setUploading(false);
      };
      
    } catch (error: any) {
      console.error('Erro ao processar o arquivo:', error);
      onError?.(error.message || 'Erro ao processar o arquivo');
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange({
      name: '',
      url: '',
      type,
      path: ''
    });
  };

  // Verificar se o documento é uma referência ou um documento completo
  const isDocumentReference = document?.url && typeof document.url === 'string' && document.url.startsWith('document_ref:');
  
  // Determinar se o documento pode ser visualizado diretamente
  const canViewDocument = document?.url && typeof document.url === 'string' && 
    (document.url.startsWith('data:') || document.url.startsWith('http'));

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <div className="mt-1 flex items-center">
        {document?.name ? (
          <div className="flex items-center space-x-2">
            <a
              href={canViewDocument ? document.url : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 bg-[#A4A4A4] text-white rounded-md hover:bg-opacity-90 transition-all duration-200"
              onClick={(e) => {
                if (isDocumentReference) {
                  e.preventDefault();
                  alert('O documento está armazenado no servidor e pode ser visualizado no painel administrativo.');
                }
              }}
            >
              <FileText size={16} />
              <span className="text-sm truncate max-w-xs">{document.name}</span>
            </a>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all duration-200"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className="cursor-pointer flex items-center justify-center px-4 py-2 bg-[#A4A4A4] text-white rounded-md hover:bg-opacity-90 transition-all duration-200">
            {uploading ? (
              <div className="flex items-center space-x-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Processando...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Upload size={16} />
                <span>Selecionar arquivo</span>
              </div>
            )}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Arquivos permitidos: PDF, JPEG, PNG (máx. 10MB)
      </p>
    </div>
  );
};

export default LocalDocumentUpload;
