import React, { useState } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

interface Document {
  name: string;
  url: string;
  type: string;
  path: string;
}

interface DocumentUploadProps {
  label: string;
  type: string;
  userId: string;
  value?: Document;
  onChange: (doc: Document | undefined) => void;
  onError?: (error: string) => void;
}

export default function DocumentUpload({
  label,
  type,
  userId,
  value,
  onChange,
  onError
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      onError?.('O arquivo deve ter no máximo 5MB');
      return;
    }

    // Check file type
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      onError?.('Apenas arquivos PDF, JPEG e PNG são permitidos');
      return;
    }

    try {
      setUploading(true);
      console.log('Iniciando upload do arquivo:', file.name);

      // Create unique filename
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      const path = `documents/${userId}/${type}/${fileName}`;
      
      console.log('Caminho do arquivo:', path);

      // Create storage reference
      const storageRef = ref(storage, path);
      console.log('Referência do storage criada');

      // Upload file with minimal metadata
      const metadata = {
        contentType: file.type
      };
      console.log('Metadados:', metadata);

      // Usar uploadBytesResumable para monitorar o progresso
      console.log('Iniciando upload...');
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      
      // Monitorar o progresso do upload
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progresso do upload
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload em progresso:', Math.round(progress) + '%');
        },
        (error) => {
          // Erro durante o upload
          console.error('Erro durante o upload:', error);
          console.error('Código do erro:', error.code);
          console.error('Mensagem do erro:', error.message);
          
          let mensagemErro = 'Erro ao fazer upload do arquivo';
          
          if (error.code === 'storage/unauthorized') {
            mensagemErro = 'Você não tem permissão para fazer upload deste arquivo.';
          } else if (error.code === 'storage/canceled') {
            mensagemErro = 'Upload cancelado.';
          } else if (error.code === 'storage/unknown') {
            mensagemErro = 'Ocorreu um erro durante o upload. Por favor, tente novamente.';
          } else {
            mensagemErro = error.message || 'Erro ao fazer upload do arquivo.';
          }
          
          onError?.(mensagemErro);
          setUploading(false);
        },
        async () => {
          // Upload concluído com sucesso
          try {
            console.log('Upload concluído, obtendo URL...');
            // Get download URL
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('URL obtida:', url);
            
            // Return document data
            onChange({
              name: file.name,
              url,
              type,
              path
            });
            
            console.log('Upload finalizado com sucesso');
          } catch (error: any) {
            console.error('Erro ao obter URL do arquivo:', error);
            onError?.(error.message || 'Erro ao obter URL do arquivo.');
          } finally {
            setUploading(false);
          }
        }
      );
    } catch (error: any) {
      console.error('Erro ao configurar o upload:', error);
      onError?.(error.message || 'Erro ao iniciar o upload do arquivo.');
      setUploading(false);
    }
  };

  const handleDelete = () => {
    if (!value?.path) return;
    onChange(undefined);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        {label}
      </label>
      
      {value ? (
        <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-700">
          <div className="flex items-center space-x-3">
            <FileText className="h-5 w-5 text-blue-400" />
            <a 
              href={value.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white hover:text-blue-400 truncate max-w-xs"
            >
              {value.name}
            </a>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={uploading}
            className="text-gray-400 hover:text-red-400 transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <X className="h-5 w-5" />
            )}
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-700 rounded-lg hover:border-gray-600 transition-colors">
            {uploading ? (
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <Upload className="h-6 w-6 text-gray-400" />
                <span className="text-sm text-gray-400">
                  Clique para fazer upload
                </span>
                <span className="text-xs text-gray-500">
                  PDF, JPEG ou PNG (max. 5MB)
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}