import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, getDocs, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
// @ts-ignore - JSZip pode não ter tipos definidos no projeto
import JSZip from 'jszip';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { db as firestore, storage } from '../../lib/firebase';
import { Image, FileText, Film, PresentationIcon, Upload, Download, Trash2, Eye, Plus, X, Bold, Italic, List, CheckSquare, Smile } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Definição do esquema do IndexedDB
interface MarketingDBSchema extends DBSchema {
  files: {
    key: string;
    value: {
      id: string;
      name: string;
      category: 'artes' | 'documentos' | 'apresentacoes' | 'videos' | 'restrita';
      fileBlob: Blob;
      thumbnailBlob?: Blob;
      fileType: string;
      fileSize: number;
      createdAt: Date;
      createdBy: string;
      description?: string;
      isCarousel?: boolean;
      carouselBlobs?: Blob[];
      imageCount?: number;
    };
    indexes: { 'by-category': string };
  };
}

// Tipos
interface MarketingFile {
  id: string;
  name: string;
  category: 'artes' | 'documentos' | 'apresentacoes' | 'videos' | 'restrita';
  fileUrl: string;
  thumbnailUrl?: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
  createdBy: string;
  description?: string;
  isCarousel?: boolean;
  carouselUrls?: string[];
  imageCount?: number;
}

// Função para inicializar o banco de dados IndexedDB
const initDB = async (): Promise<IDBPDatabase<MarketingDBSchema>> => {
  return openDB<MarketingDBSchema>('marketing-files-db', 1, {
    upgrade(db) {
      // Criar store de arquivos se não existir
      if (!db.objectStoreNames.contains('files')) {
        const store = db.createObjectStore('files', { keyPath: 'id' });
        store.createIndex('by-category', 'category');
      }
    },
  });
};

// Função para converter Blob para URL
const blobToURL = (blob: Blob): string => {
  return URL.createObjectURL(blob);
};

// Função para converter File para Blob
const fileToBlob = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
      resolve(blob);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Componente principal
export default function Marketing() {
  const { user } = useAuth();
  const [files, setFiles] = useState<MarketingFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'artes' | 'documentos' | 'apresentacoes' | 'videos' | 'restrita'>('artes');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [db, setDb] = useState<IDBPDatabase<MarketingDBSchema> | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<MarketingFile | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<'artes' | 'documentos' | 'apresentacoes' | 'videos' | 'restrita'>('artes');
  const [fileDescription, setFileDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [uploadType, setUploadType] = useState<'single' | 'carousel'>('single');
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [textFormatting, setTextFormatting] = useState({
    bold: false,
    italic: false,
    list: false
  });

  // Verificar se o usuário é administrador
  const isAdmin = user?.roleKey === 'admin';
  
  // Inicializar o banco de dados e buscar arquivos
  useEffect(() => {
    const setupDB = async () => {
      try {
        setLoading(true);
        const database = await initDB();
        setDb(database);
        fetchFiles(database);
      } catch (error) {
        console.error('Erro ao inicializar o banco de dados:', error);
        setError('Erro ao inicializar o armazenamento local. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };
    
    setupDB();
    
    // Limpar URLs de objeto ao desmontar o componente
    return () => {
      files.forEach(file => {
        if (file.fileUrl && file.fileUrl.startsWith('blob:')) {
          URL.revokeObjectURL(file.fileUrl);
        }
        if (file.carouselUrls) {
          file.carouselUrls.forEach(url => {
            if (url.startsWith('blob:')) {
              URL.revokeObjectURL(url);
            }
          });
        }
      });
    };
  }, []);

  // Função para buscar arquivos do IndexedDB e Firestore
  const fetchFiles = async (database: IDBPDatabase<MarketingDBSchema>) => {
    try {
      // Buscar arquivos do IndexedDB
      const indexedDBFiles: MarketingFile[] = [];
      const tx = database.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      
      // Buscar todos os arquivos
      const allFiles = await store.getAll();
      
      // Converter os blobs em URLs para exibição
      for (const fileData of allFiles) {
        const fileUrl = blobToURL(fileData.fileBlob);
        
        let carouselUrls: string[] | undefined;
        if (fileData.isCarousel && fileData.carouselBlobs) {
          carouselUrls = fileData.carouselBlobs.map(blob => blobToURL(blob));
        }
        
        indexedDBFiles.push({
          id: fileData.id,
          name: fileData.name,
          category: fileData.category,
          fileUrl: fileUrl,
          fileType: fileData.fileType,
          fileSize: fileData.fileSize,
          createdAt: fileData.createdAt,
          createdBy: fileData.createdBy,
          description: fileData.description,
          isCarousel: fileData.isCarousel,
          carouselUrls: carouselUrls,
          imageCount: fileData.isCarousel ? fileData.carouselBlobs?.length : undefined
        });
      }
      
      // Tentar buscar do Firestore também (opcional, pode ser removido se não precisar)
      try {
        const filesCollection = collection(firestore, 'marketingFiles');
        const filesSnapshot = await getDocs(query(filesCollection));
        
        const firestoreFiles: MarketingFile[] = [];
        
        filesSnapshot.forEach((doc) => {
          const data = doc.data();
          firestoreFiles.push({
            id: doc.id,
            name: data.name,
            category: data.category,
            fileUrl: data.fileUrl,
            thumbnailUrl: data.thumbnailUrl,
            fileType: data.fileType,
            fileSize: data.fileSize,
            createdAt: data.createdAt?.toDate() || new Date(),
            createdBy: data.createdBy,
            description: data.description,
            isCarousel: data.isCarousel,
            carouselUrls: data.carouselUrls,
            imageCount: data.imageCount
          });
        });
        
        // Combinar arquivos do Firestore e IndexedDB (priorizando IndexedDB)
        const combinedFiles = [...indexedDBFiles];
        
        // Adicionar arquivos do Firestore que não estão no IndexedDB
        for (const firestoreFile of firestoreFiles) {
          if (!combinedFiles.some(file => file.id === firestoreFile.id)) {
            combinedFiles.push(firestoreFile);
          }
        }
        
        setFiles(combinedFiles);
      } catch (firestoreError) {
        console.warn('Não foi possível buscar do Firestore, usando apenas dados locais:', firestoreError);
        // Se falhar, usar apenas os dados do IndexedDB
        setFiles(indexedDBFiles);
      }
    } catch (error) {
      console.error('Erro ao buscar arquivos:', error);
      setError('Erro ao carregar arquivos. Por favor, tente novamente.');
    }
  };

  // Filtrar arquivos por categoria
  const filteredFiles = files.filter(file => file.category === activeCategory);

  // Função para excluir arquivo (funciona com arquivos locais e do Firestore)
  const handleDeleteFile = async (fileId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este arquivo?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Encontrar o arquivo a ser excluído
      const fileToDelete = files.find(file => file.id === fileId);
      
      if (!fileToDelete) {
        setError('Arquivo não encontrado');
        return;
      }
      
      // Verificar se o banco de dados está inicializado
      if (!db) {
        setError('Banco de dados não inicializado. Por favor, recarregue a página.');
        return;
      }
      
      // Excluir do IndexedDB
      try {
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        await store.delete(fileId);
        await tx.done;
      } catch (indexedDBError) {
        console.warn('Não foi possível excluir do IndexedDB:', indexedDBError);
        // Continuar mesmo se falhar no IndexedDB
      }
      
      // Tentar excluir do Firestore
      try {
        const fileRef = doc(firestore, 'marketingFiles', fileId);
        await deleteDoc(fileRef);
        
        // Também excluir do Storage se tiver URL do Firebase
        if (fileToDelete.fileUrl && fileToDelete.fileUrl.includes('firebasestorage')) {
          const storageRef = ref(storage, fileToDelete.fileUrl);
          await deleteObject(storageRef);
          
          // Se for carrossel, excluir todas as imagens
          if (fileToDelete.isCarousel && fileToDelete.carouselUrls) {
            for (const url of fileToDelete.carouselUrls) {
              if (url.includes('firebasestorage')) {
                const imgRef = ref(storage, url);
                await deleteObject(imgRef);
              }
            }
          }
        }
      } catch (firestoreError) {
        console.warn('Não foi possível excluir do Firestore:', firestoreError);
        // Continuar mesmo se falhar no Firestore
      }
      
      // Revogar URLs de objeto se for local
      if (fileToDelete.fileUrl && fileToDelete.fileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(fileToDelete.fileUrl);
      }
      
      if (fileToDelete.carouselUrls) {
        fileToDelete.carouselUrls.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
      }
      
      // Atualizar a lista de arquivos
      setFiles(files.filter(file => file.id !== fileId));
      
      // Mostrar mensagem de sucesso
      alert('Arquivo excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      setError('Erro ao excluir arquivo. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  
  // Regras de validação para cada categoria
  const uploadRules = {
    artes: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png'],
      errorMessage: 'Imagens devem ser JPG, JPEG ou PNG com no máximo 10MB'
    },
    documentos: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['application/pdf'],
      errorMessage: 'Documentos devem ser PDF com no máximo 10MB'
    },
    apresentacoes: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
      errorMessage: 'Apresentações devem ser PDF, JPG, JPEG ou PNG com no máximo 10MB'
    },
    videos: {
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedTypes: ['video/mp4', 'video/quicktime'],
      errorMessage: 'Vídeos devem ser MP4 ou MOV com no máximo 50MB'
    },
    restrita: {
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      errorMessage: 'Arquivos da Área Restrita devem ter no máximo 50MB (PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX)'
    }
  };
  
  // Função para validar o arquivo conforme as regras da categoria
  const validateFile = (file: File, category: 'artes' | 'documentos' | 'apresentacoes' | 'videos' | 'restrita'): string | null => {
    const rules = uploadRules[category];
    
    // Verificar tamanho
    if (file.size > rules.maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (rules.maxSize / (1024 * 1024)).toFixed(0);
      return `Arquivo muito grande (${sizeMB}MB). O tamanho máximo permitido é ${maxSizeMB}MB.`;
    }
    
    // Verificar tipo
    if (!rules.allowedTypes.includes(file.type)) {
      const allowedExtensions = rules.allowedTypes.map(type => {
        return type.split('/')[1].toUpperCase();
      }).join(', ');
      return `Tipo de arquivo não permitido. Apenas ${allowedExtensions} são aceitos.`;
    }
    
    return null; // Arquivo válido
  };
  
  // Função para upload de arquivos usando IndexedDB
  const handleUploadFile = async () => {
    // Limpar erros anteriores
    setError(null);
    
    // Verificar usuário
    if (!user) {
      setError('Você precisa estar autenticado para fazer upload de arquivos');
      return;
    }
    
    // Verificar se temos arquivos para upload
    if (uploadType === 'single' && !fileToUpload) {
      setError('Nenhum arquivo selecionado');
      return;
    }
    
    if (uploadType === 'carousel' && multipleFiles.length === 0) {
      setError('Nenhuma imagem selecionada para o carrossel');
      return;
    }
    
    // Verificar se o banco de dados está inicializado
    if (!db) {
      setError('Banco de dados não inicializado. Por favor, recarregue a página.');
      return;
    }
    
    // Iniciar progresso de upload e indicador de carregamento
    setUploadProgress(0);
    setLoading(true);
    
    try {
      // Criar timestamp para nome único
      const timestamp = new Date().getTime();
      let newFile: MarketingFile;
      
      // Simular progresso para feedback visual
      for (let progress = 0; progress <= 50; progress += 10) {
        setUploadProgress(progress);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (uploadType === 'single' && fileToUpload) {
        // Validar arquivo conforme regras da categoria
        const validationError = validateFile(fileToUpload, uploadCategory);
        if (validationError) {
          setError(validationError);
          setUploadProgress(0);
          return;
        }
        
        // Converter arquivo para Blob para armazenamento
        const fileBlob = await fileToBlob(fileToUpload);
        
        // Criar URL para visualização imediata
        const fileUrl = blobToURL(fileBlob);
        
        // Atualizar progresso
        setUploadProgress(70);
        
        // Criar objeto do arquivo para a interface
        newFile = {
          id: `file_${timestamp}`,
          name: fileToUpload.name,
          category: uploadCategory,
          fileUrl: fileUrl,
          fileType: fileToUpload.type,
          fileSize: fileToUpload.size,
          createdAt: new Date(),
          createdBy: user.email || 'unknown',
          description: fileDescription
        };
        
        // Salvar no IndexedDB
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        
        await store.put({
          id: newFile.id,
          name: newFile.name,
          category: newFile.category,
          fileBlob: fileBlob,
          fileType: newFile.fileType,
          fileSize: newFile.fileSize,
          createdAt: newFile.createdAt,
          createdBy: newFile.createdBy,
          description: newFile.description
        });
        
        await tx.done;
        setUploadProgress(90);
        
      } else if (multipleFiles.length > 0) {
        // Converter cada imagem para Blob
        const carouselBlobs: Blob[] = [];
        for (let i = 0; i < multipleFiles.length; i++) {
          const blob = await fileToBlob(multipleFiles[i]);
          carouselBlobs.push(blob);
          setUploadProgress(50 + Math.round((i / multipleFiles.length) * 20));
        }
        
        // Criar URLs para visualização
        const carouselUrls = carouselBlobs.map(blob => blobToURL(blob));
        
        // Atualizar progresso
        setUploadProgress(70);
        
        // ID único para o carrossel
        const carouselId = `carousel_${timestamp}`;
        
        // Criar objeto do carrossel para a interface
        newFile = {
          id: carouselId,
          name: `Carrossel (${multipleFiles.length} imagens)`,
          category: 'artes',
          fileUrl: carouselUrls[0], // URL da primeira imagem como capa
          fileType: 'carousel/images',
          fileSize: multipleFiles.reduce((total, file) => total + file.size, 0),
          createdAt: new Date(),
          createdBy: user.email || 'unknown',
          description: fileDescription,
          isCarousel: true,
          carouselUrls: carouselUrls,
          imageCount: multipleFiles.length
        };
        
        // Salvar no IndexedDB
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        
        await store.put({
          id: newFile.id,
          name: newFile.name,
          category: newFile.category,
          fileBlob: carouselBlobs[0], // Primeira imagem como capa
          fileType: newFile.fileType,
          fileSize: newFile.fileSize,
          createdAt: newFile.createdAt,
          createdBy: newFile.createdBy,
          description: newFile.description,
          isCarousel: true,
          carouselBlobs: carouselBlobs,
          imageCount: carouselBlobs.length
        });
        
        await tx.done;
        setUploadProgress(90);
      } else {
        throw new Error('Nenhum arquivo selecionado');
      }
      
      // Concluir upload e mostrar sucesso
      setUploadProgress(100);
      
      // Adicionar o novo arquivo à lista
      setFiles(prevFiles => {
        const updatedFiles = [newFile, ...prevFiles];
        
        // Salvar no localStorage para persistência
        try {
          // Salvar apenas os metadados sem as URLs de objeto
          const filesForStorage = updatedFiles.map(file => ({
            ...file,
            fileUrl: file.isCarousel ? '' : '',
            carouselUrls: file.isCarousel ? [] : undefined,
            createdAt: file.createdAt.toISOString()
          }));
          localStorage.setItem('marketingFiles', JSON.stringify(filesForStorage));
        } catch (storageError) {
          console.warn('Erro ao salvar no localStorage:', storageError);
        }
        
        return updatedFiles;
      });
      
      // Fechar modal e mostrar sucesso
      setShowUploadModal(false);
      setShowSuccessModal(true);
      
      // Limpar formulário
      setFileToUpload(null);
      setMultipleFiles([]);
      setFileDescription('');
      setTextFormatting({ bold: false, italic: false, list: false });
      
      console.log('Upload concluído com sucesso!');
    } catch (error) {
      console.error('Erro no upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido durante o upload';
      setError(errorMessage);
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };
  
  // Função para aplicar formatação ao texto selecionado
  const applyFormatting = (type: 'bold' | 'italic' | 'list') => {
    // Obter a referência do textarea
    const textarea = document.getElementById('description-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    // Obter a seleção atual
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = fileDescription.substring(start, end);
    
    // Se não há texto selecionado, atualizar o estado de formatação apenas
    if (start === end) {
      setTextFormatting(prev => ({
        ...prev,
        [type]: !prev[type]
      }));
      return;
    }
    
    // Aplicar formatação ao texto selecionado
    let newText = fileDescription;
    let formattedSelection = selectedText;
    
    if (type === 'bold') {
      // Verificar se o texto já está em negrito
      const isBold = selectedText.startsWith('**') && selectedText.endsWith('**');
      
      if (isBold) {
        // Remover formatação de negrito
        formattedSelection = selectedText.slice(2, -2);
      } else {
        // Adicionar formatação de negrito
        formattedSelection = `**${selectedText}**`;
      }
    } else if (type === 'italic') {
      // Verificar se o texto já está em itálico
      const isItalic = selectedText.startsWith('*') && selectedText.endsWith('*') && 
                      !(selectedText.startsWith('**') && selectedText.endsWith('**'));
      
      if (isItalic) {
        // Remover formatação de itálico
        formattedSelection = selectedText.slice(1, -1);
      } else {
        // Adicionar formatação de itálico
        formattedSelection = `*${selectedText}*`;
      }
    } else if (type === 'list') {
      // Adicionar formatação de lista para cada linha
      const lines = selectedText.split('\n');
      const hasListItems = lines.some(line => line.startsWith('• '));
      
      if (hasListItems) {
        // Remover formatação de lista
        formattedSelection = lines
          .map(line => line.replace(/^• /, ''))
          .join('\n');
      } else {
        // Adicionar formatação de lista
        formattedSelection = lines
          .map(line => `• ${line}`)
          .join('\n');
      }
    }
    
    // Substituir o texto selecionado pelo texto formatado
    newText = fileDescription.substring(0, start) + formattedSelection + fileDescription.substring(end);
    setFileDescription(newText);
    
    // Restaurar a seleção após a atualização
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + formattedSelection.length);
    }, 0);
  };
  
  // Função para adicionar emoji à descrição
  const addEmoji = (emoji: string) => {
    setFileDescription(prev => prev + emoji);
  };
  
  // Lista de emojis comuns
  const commonEmojis = [
    '😀', '👍', '🔥', '⭐', '❤️', '🎉', '✅', '🚀', '💯', '📊',
    '📈', '📝', '💼', '🏆', '💡', '📱', '💻', '🌟', '👏', '🤝'
  ];
  
  // Função para fazer download de todos os arquivos de um carrossel
  const handleDownloadAllCarouselImages = async (carouselFile: MarketingFile) => {
    if (!carouselFile.isCarousel || !carouselFile.carouselUrls || carouselFile.carouselUrls.length === 0) {
      setError('Este arquivo não é um carrossel ou não possui imagens.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Criar um elemento para indicar o progresso do download
      const progressElement = document.createElement('div');
      progressElement.style.position = 'fixed';
      progressElement.style.top = '50%';
      progressElement.style.left = '50%';
      progressElement.style.transform = 'translate(-50%, -50%)';
      progressElement.style.padding = '20px';
      progressElement.style.background = 'rgba(0, 0, 0, 0.8)';
      progressElement.style.color = 'white';
      progressElement.style.borderRadius = '10px';
      progressElement.style.zIndex = '9999';
      progressElement.style.textAlign = 'center';
      progressElement.style.minWidth = '300px';
      progressElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
      
      // Adicionar título e conteúdo
      progressElement.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold;">Download do Carrossel</div>
        <div>Preparando arquivos: 0/${carouselFile.carouselUrls.length}</div>
        <div style="margin-top: 10px; height: 4px; background: #333; border-radius: 2px; overflow: hidden;">
          <div id="progress-bar" style="height: 100%; width: 0%; background: #2563eb; transition: width 0.3s;"></div>
        </div>
      `;
      document.body.appendChild(progressElement);
      
      // Criar um ZIP para armazenar todas as imagens
      const zip = new JSZip();
      
      // Adicionar cada imagem ao ZIP
      for (let i = 0; i < carouselFile.carouselUrls.length; i++) {
        const url = carouselFile.carouselUrls[i];
        
        // Atualizar texto de progresso
        const progressText = progressElement.querySelector('div:nth-child(2)');
        if (progressText) {
          progressText.textContent = `Baixando imagem ${i+1}/${carouselFile.carouselUrls.length}`;
        }
        
        // Atualizar barra de progresso
        const progressBar = progressElement.querySelector('#progress-bar') as HTMLElement;
        if (progressBar) {
          const percentage = Math.round(((i + 1) / carouselFile.carouselUrls.length) * 80); // 80% para download, 20% para geração do ZIP
          progressBar.style.width = `${percentage}%`;
        }
        
        try {
          // Fazer download da imagem
          const response = await fetch(url);
          const blob = await response.blob();
          
          // Determinar a extensão do arquivo com base no tipo MIME
          let extension = 'jpg'; // Padrão
          if (blob.type === 'image/png') extension = 'png';
          else if (blob.type === 'image/gif') extension = 'gif';
          else if (blob.type === 'image/webp') extension = 'webp';
          
          // Adicionar ao ZIP com nome mais descritivo
          const fileName = `imagem_${String(i+1).padStart(2, '0')}.${extension}`;
          zip.file(fileName, blob);
        } catch (error) {
          console.error(`Erro ao baixar imagem ${i+1}:`, error);
        }
      }
      
      // Gerar o arquivo ZIP
      const progressText = progressElement.querySelector('div:nth-child(2)');
      if (progressText) {
        progressText.textContent = 'Gerando arquivo ZIP...';
      }
      
      // Atualizar barra para 90%
      const progressBar = progressElement.querySelector('#progress-bar') as HTMLElement;
      if (progressBar) {
        progressBar.style.width = '90%';
      }
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Atualizar barra para 100%
      if (progressBar) {
        progressBar.style.width = '100%';
      }
      
      // Atualizar texto para concluído
      if (progressText) {
        progressText.textContent = 'Preparando download...';
      }
      
      // Criar um link para download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      
      // Criar um nome de arquivo mais amigável
      const dataAtual = new Date();
      const dataFormatada = format(dataAtual, 'yyyy-MM-dd');
      const nomeArquivo = `carrossel_${dataFormatada}_${carouselFile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
      link.download = nomeArquivo;
      
      // Iniciar o download
      link.click();
      
      // Mostrar mensagem de sucesso por 2 segundos antes de fechar
      if (progressText) {
        progressText.textContent = 'Download iniciado com sucesso!';
      }
      
      // Aguardar 2 segundos antes de fechar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Limpar
      URL.revokeObjectURL(link.href);
      document.body.removeChild(progressElement);
      
    } catch (error) {
      console.error('Erro ao fazer download do carrossel:', error);
      setError('Erro ao fazer download das imagens do carrossel.');
    } finally {
      setLoading(false);
    }
  };
  
  // Função para formatar o tamanho do arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Função para formatar data
  const formatDate = (date: Date): string => {
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };
  
  // Função para verificar se um arquivo é novo (adicionado nas últimas 24 horas)
  const isNewFile = (date: Date): boolean => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffHours = diffTime / (1000 * 60 * 60);
    return diffHours < 24;
  };
  
  // Função para criar uma cópia local dos arquivos
  // Removida a conversão para Base64 que estava causando problemas
  
  // Função para formatar texto markdown para HTML
  const formatMarkdownText = (text: string): string => {
    // Converter quebras de linha
    let formattedText = text.replace(/\n/g, '<br>');
    
    // Converter negrito (** **)
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Converter itálico (* *)
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Converter listas (• item)
    formattedText = formattedText.replace(/• (.*?)(?=<br>|$)/g, '<li>$1</li>');
    formattedText = formattedText.replace(/<li>(.*?)<\/li>(?=<li>|$)/g, '<ul><li>$1</li></ul>');
    formattedText = formattedText.replace(/<\/ul><ul>/g, '');
    
    return formattedText;
  };
  
  // Função para formatar data relativa (há quanto tempo)
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) {
      return `há ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffHours < 24) {
      return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffDays < 7) {
      return `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    } else {
      return formatDate(date);
    }
  };

  // Função para obter os tipos de arquivo aceitos com base na categoria selecionada
  const getAcceptedFileTypes = (): string => {
    switch (uploadCategory) {
      case 'artes':
        return '.jpg,.jpeg,.png';
      case 'documentos':
        return '.pdf';
      case 'apresentacoes':
        return '.pdf,.jpg,.jpeg,.png';
      case 'videos':
        return '.mp4,.mov';
      case 'restrita':
        return '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
      default:
        return '*';
    }
  };
  
  // Função para obter a mensagem de tipos de arquivo aceitos
  const getFileTypeMessage = (): string => {
    switch (uploadCategory) {
      case 'artes':
        return 'Imagens: JPG, JPEG, PNG (máx. 10MB)';
      case 'documentos':
        return 'Documentos: PDF (máx. 10MB)';
      case 'apresentacoes':
        return 'Apresentações: PDF, JPG, JPEG, PNG (máx. 10MB)';
      case 'videos':
        return 'Vídeos: MP4, MOV (máx. 50MB)';
      case 'restrita':
        return 'Área Restrita: PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX (máx. 50MB)';
      default:
        return 'Selecione uma categoria primeiro';
    }
  };
  
  // Renderizar categorias
  const renderCategories = () => {
    const categories = [
      { 
        id: 'artes', 
        label: 'Artes Gráficas', 
        icon: Image, 
        color: '#ec4899', // Rosa (pink-500)
        hoverBg: 'rgba(236, 72, 153, 0.1)'
      },
      { 
        id: 'documentos', 
        label: 'Documentos PDF', 
        icon: FileText, 
        color: '#f97316', // Laranja (orange-500)
        hoverBg: 'rgba(249, 115, 22, 0.1)'
      },
      { 
        id: 'apresentacoes', 
        label: 'Apresentações', 
        icon: PresentationIcon, 
        color: '#eab308', // Amarelo (yellow-500)
        hoverBg: 'rgba(234, 179, 8, 0.1)'
      },
      { 
        id: 'videos', 
        label: 'Vídeos', 
        icon: Film, 
        color: '#3b82f6', // Azul (blue-500)
        hoverBg: 'rgba(59, 130, 246, 0.1)'
      }
    ];
    
    // Adicionar categoria restrita apenas para administradores
    if (isAdmin) {
      categories.push({
        id: 'restrita',
        label: 'Área Restrita',
        icon: FileText,
        color: '#dc2626', // Vermelho (red-600)
        hoverBg: 'rgba(220, 38, 38, 0.1)'
      });
    }

    return (
      <div className="flex flex-wrap gap-4 mb-6 pb-2 overflow-visible">
        {categories.map(category => {
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => {
                setActiveCategory(category.id as any);
                // Limpar arquivo selecionado ao mudar de categoria
                if (fileToUpload) {
                  setFileToUpload(null);
                  setError(null);
                }
              }}
              className={`flex items-center px-6 py-3 rounded-md transition-all duration-300 whitespace-nowrap ${isActive ? 'scale-105' : ''}`}
              style={{
                backgroundColor: isActive ? 'rgba(17, 24, 39, 0.7)' : 'black',
                color: isActive ? category.color : '#d1d5db',
                border: `1px solid ${isActive ? category.color : 'rgba(255, 255, 255, 0.1)'}`,
                minWidth: 'max-content',
                margin: '0.25rem',
                ...(isActive ? {} : { '&:hover': { backgroundColor: category.hoverBg } })
              }}
            >
              <category.icon 
                className="h-5 w-5 mr-3" 
                style={{ 
                  color: isActive ? category.color : '#d1d5db'
                }} 
              />
              <span className="text-sm font-medium">{category.label}</span>
            </button>
          );
        })}
      </div>
    );
  };
  
  // Adicionar mensagem de debug para verificar o estado
  useEffect(() => {
    console.log('Estado atual da página Marketing:', {
      loading,
      error,
      filesCount: files.length,
      activeCategory,
      filteredFilesCount: filteredFiles.length,
      isAdmin
    });
  }, [loading, error, files, activeCategory, filteredFiles, isAdmin]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Materiais de Marketing</h1>
        
        {isAdmin && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Upload className="h-4 w-4 mr-2" />
            <span>Upload</span>
          </button>
        )}
      </div>

      {/* Navegação por categorias */}
      {renderCategories()}

      {/* Área de conteúdo principal */}
      <div className="bg-black rounded-lg border border-gray-800 p-6">
        {error ? (
          <div className="text-center text-red-500 py-10">{error}</div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            <p className="text-lg">Nenhum arquivo encontrado nesta categoria.</p>
            {isAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-4 inline-flex items-center px-4 py-2 bg-black text-purple-400 rounded-md border border-purple-500 transition-all duration-300 hover:scale-105"
                style={{
                  boxShadow: '0 0 5px rgba(168, 85, 247, 0.5), 0 0 10px rgba(168, 85, 247, 0.3)',
                  textShadow: '0 0 5px #a855f7, 0 0 8px #a855f7'
                }}
              >
                <Plus className="h-4 w-4 mr-2" style={{ filter: 'drop-shadow(0 0 2px #a855f7)' }} />
                <span>Adicionar arquivo</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Aqui vão os cards dos arquivos */}
            {filteredFiles.map(file => (
              <div key={file.id} className="bg-black rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500 transition-all duration-300 transform hover:scale-[1.03] hover:shadow-lg hover:shadow-blue-500/30 relative group hover:ring-1 hover:ring-blue-500/50 hover:z-10">
                {/* Indicador de arquivo novo */}
                {isNewFile(file.createdAt) && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center border border-green-500 animate-pulse-slow">
                      <span className="animate-pulse mr-1 h-2 w-2 bg-green-500 rounded-full inline-block"></span>
                      <span className="text-green-500 font-bold tracking-wider" style={{textShadow: '0 0 5px #10b981, 0 0 10px #10b981, 0 0 15px #10b981'}}>NOVO</span>
                    </div>
                  </div>
                )}
                
                <div className="h-40 bg-gray-700 flex items-center justify-center overflow-hidden relative">
                  {file.isCarousel ? (
                    <>
                      <div className="w-full h-full flex items-center justify-center">
                        {file.carouselUrls && file.carouselUrls.length > 0 ? (
                          <img
                            src={file.carouselUrls[0]}
                            alt={file.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error('Erro ao carregar imagem do carrossel:', e);
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.innerHTML = `
                                <div class="flex flex-col items-center justify-center w-full h-full">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <p class="text-xs text-gray-500 mt-2">Imagem não disponível</p>
                                </div>
                              `;
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <Image className="h-16 w-16 text-gray-400" />
                            <p className="text-xs text-gray-500 mt-2">Carrossel sem imagens</p>
                          </div>
                        )}
                      </div>
                      {/* Indicador de carrossel */}
                      <div className="absolute top-2 left-2 bg-black text-blue-400 text-xs px-3 py-1 rounded-md flex items-center border border-blue-500 shadow-lg" style={{boxShadow: '0 0 5px rgba(59, 130, 246, 0.5), 0 0 10px rgba(59, 130, 246, 0.3)'}}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{filter: 'drop-shadow(0 0 2px #3b82f6)'}}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                        <span style={{textShadow: '0 0 5px #3b82f6, 0 0 8px #3b82f6'}}>{file.imageCount} imagens</span>
                      </div>
                    </>
                  ) : file.fileType.startsWith('image/') || file.fileUrl.startsWith('data:image/') ? (
                    <>
                      <div className="w-full h-full flex items-center justify-center">
                        <img
                          src={file.fileUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('Erro ao carregar imagem:', e);
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = `
                              <div class="flex flex-col items-center justify-center w-full h-full">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p class="text-xs text-gray-500 mt-2">Imagem não disponível</p>
                              </div>
                            `;
                          }}
                        />
                      </div>
                    </>
                  ) : file.fileType === 'application/pdf' ? (
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="h-16 w-16 text-red-400" />
                      <span className="text-xs text-gray-400 mt-2">Documento PDF</span>
                    </div>
                  ) : file.fileType.startsWith('video/') ? (
                    <div className="flex flex-col items-center justify-center">
                      <Film className="h-16 w-16 text-blue-400" />
                      <span className="text-xs text-gray-400 mt-2">Vídeo</span>
                    </div>
                  ) : file.category === 'apresentacoes' ? (
                    <div className="flex flex-col items-center justify-center">
                      <PresentationIcon className="h-16 w-16 text-yellow-400" />
                      <span className="text-xs text-gray-400 mt-2">Apresentação</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      {file.category === 'artes' && <Image className="h-16 w-16 text-gray-400" />}
                      {file.category === 'documentos' && <FileText className="h-16 w-16 text-gray-400" />}
                      {file.category === 'videos' && <Film className="h-16 w-16 text-gray-400" />}
                    </div>
                  )}
                </div>
                <div className="p-4 group-hover:bg-black/70">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-white font-medium truncate mr-2 group-hover:text-blue-400 transition-colors duration-300">{file.name}</h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap group-hover:text-gray-300 transition-colors duration-300" title={formatDate(file.createdAt)}>
                      {formatRelativeTime(file.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm truncate group-hover:text-gray-300 transition-colors duration-300">{file.description || 'Sem descrição'}</p>
                  
                  {/* Removida a barra de progresso */}
                  
                  <div className="flex justify-between mt-4">
                    <button
                      onClick={() => {
                        setSelectedFile(file);
                        setShowPreviewModal(true);
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-all duration-300 transform hover:scale-110 p-1 rounded-full hover:bg-blue-900/30"
                      title="Visualizar"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    
                    <a
                      href={file.fileUrl}
                      download={file.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 transition-all duration-300 transform hover:scale-110 p-1 rounded-full hover:bg-green-900/30"
                      title="Download"
                    >
                      <Download className="h-5 w-5" />
                    </a>
                    
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="text-red-400 hover:text-red-300 transition-all duration-300 transform hover:scale-110 p-1 rounded-full hover:bg-red-900/30"
                        title="Excluir"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
          <div className="bg-black rounded-lg border border-gray-800 p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Upload de Material</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Categoria
              </label>
              <select
                id="upload-category"
                name="upload-category"
                value={uploadCategory}
                onChange={(e) => {
                  const category = e.target.value as 'artes' | 'documentos' | 'apresentacoes' | 'videos' | 'restrita';
                  setUploadCategory(category);
                  // Limpar arquivos selecionados ao mudar de categoria
                  setFileToUpload(null);
                  setMultipleFiles([]);
                  // Resetar para imagem única se mudar de categoria
                  if (category !== 'artes') {
                    setUploadType('single');
                  }
                }}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="artes">Artes Gráficas</option>
                <option value="documentos">Documentos PDF</option>
                <option value="apresentacoes">Apresentações</option>
                <option value="videos">Vídeos</option>
                {isAdmin && <option value="restrita">Área Restrita</option>}
              </select>
            </div>
            
            {/* Seletor de tipo de upload (apenas para Artes Gráficas) */}
            {uploadCategory === 'artes' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tipo de Upload
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      id="upload-type-single"
                      name="uploadType"
                      value="single"
                      checked={uploadType === 'single'}
                      onChange={() => {
                        setUploadType('single');
                        setMultipleFiles([]);
                      }}
                      className="mr-2 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-white">Imagem Única</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      id="upload-type-carousel"
                      name="uploadType"
                      value="carousel"
                      checked={uploadType === 'carousel'}
                      onChange={() => {
                        setUploadType('carousel');
                        setFileToUpload(null);
                      }}
                      className="mr-2 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-white">Carrossel (até 10 imagens)</span>
                  </label>
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {uploadType === 'carousel' ? 'Imagens (selecione até 10)' : 'Arquivo'}
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-900 border-gray-700 hover:border-blue-500 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-blue-400" />
                    <p className="mb-2 text-sm text-gray-300">
                      <span className="font-semibold">Clique para selecionar</span> ou arraste e solte
                    </p>
                    {uploadType === 'single' ? (
                      <p className="text-xs text-gray-500">
                        {fileToUpload ? fileToUpload.name : getFileTypeMessage()}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        {multipleFiles.length > 0 
                          ? `${multipleFiles.length} ${multipleFiles.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}` 
                          : 'Selecione até 10 imagens JPG, JPEG ou PNG'}
                      </p>
                    )}
                  </div>
                  {uploadType === 'single' ? (
                    <input 
                      type="file"
                      id="file-upload-single"
                      name="file-upload-single"
                      className="hidden" 
                      accept={getAcceptedFileTypes()}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setFileToUpload(e.target.files[0]);
                          setError(null);
                        }
                      }}
                    />
                  ) : (
                    <input 
                      type="file"
                      id="file-upload-multiple"
                      name="file-upload-multiple"
                      multiple
                      className="hidden" 
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files);
                          // Limitar a 10 imagens
                          const selectedFiles = files.slice(0, 10);
                          
                          // Validar cada arquivo
                          let hasError = false;
                          selectedFiles.forEach(file => {
                            const validationError = validateFile(file, 'artes');
                            if (validationError) {
                              setError(`Erro em ${file.name}: ${validationError}`);
                              hasError = true;
                            }
                          });
                          
                          if (!hasError) {
                            setMultipleFiles(selectedFiles);
                            setError(null);
                          }
                        }
                      }}
                    />
                  )}
                </label>
              </div>
              
              {/* Visualização das imagens selecionadas para carrossel */}
              {uploadType === 'carousel' && multipleFiles.length > 0 && (
                <div className="mt-4">
                  <div className="grid grid-cols-5 gap-2">
                    {multipleFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={`Imagem ${index + 1}`}
                          className="w-full h-16 object-cover rounded-md"
                        />
                        <button
                          onClick={() => {
                            const newFiles = [...multipleFiles];
                            newFiles.splice(index, 1);
                            setMultipleFiles(newFiles);
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Descrição
              </label>
              <div className="flex flex-wrap gap-2 mb-2 bg-gray-900 p-2 rounded-t-md border-t border-x border-gray-700">
                <button 
                  onClick={() => applyFormatting('bold')}
                  className={`p-1.5 rounded ${textFormatting.bold ? 'bg-blue-700' : 'bg-gray-800 hover:bg-gray-700'}`}
                  title="Negrito"
                >
                  <Bold className="h-4 w-4 text-white" />
                </button>
                <button 
                  onClick={() => applyFormatting('italic')}
                  className={`p-1.5 rounded ${textFormatting.italic ? 'bg-blue-700' : 'bg-gray-800 hover:bg-gray-700'}`}
                  title="Itálico"
                >
                  <Italic className="h-4 w-4 text-white" />
                </button>
                <button 
                  onClick={() => applyFormatting('list')}
                  className={`p-1.5 rounded ${textFormatting.list ? 'bg-blue-700' : 'bg-gray-800 hover:bg-gray-700'}`}
                  title="Lista"
                >
                  <List className="h-4 w-4 text-white" />
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <button 
                    className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 flex items-center"
                    title="Emojis"
                  >
                    <Smile className="h-4 w-4 text-white" />
                  </button>
                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                    {commonEmojis.slice(0, 8).map((emoji, index) => (
                      <button 
                        key={index}
                        onClick={() => addEmoji(emoji)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 rounded"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <textarea
                id="description-textarea"
                name="description"
                value={fileDescription}
                onChange={(e) => setFileDescription(e.target.value)}
                className="w-full bg-gray-900 border-b border-x border-gray-700 rounded-b-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={4}
                placeholder="Descreva o material... Selecione texto para formatar"
              />
              <p className="text-xs text-gray-500 mt-1">Use **texto** para negrito, *texto* para itálico</p>
            </div>
            
            {/* Barra de progresso */}
            {uploadProgress > 0 && (
              <div className="mb-6">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Progresso do upload</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="relative w-full">
                  <div className="w-full bg-gray-800 rounded-full h-6 overflow-hidden border border-gray-700 shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 h-full rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-bold shadow-lg relative overflow-hidden" 
                      style={{ width: `${uploadProgress}%` }}
                    >
                      {/* Efeito de brilho animado */}
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="animate-[shimmer_2s_infinite] absolute -inset-[10px] opacity-20 bg-gradient-to-r from-transparent via-white to-transparent transform -translate-x-full"></div>
                      </div>
                      {uploadProgress >= 10 && (
                        <div className="flex items-center z-10">
                          {uploadProgress === 100 ? (
                            <>
                              <CheckSquare className="h-3 w-3 mr-1" />
                              <span>Concluído!</span>
                            </>
                          ) : (
                            <span>{uploadProgress}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Mensagem de erro */}
            {error && (
              <div className="mb-6 p-3 bg-red-900/50 border border-red-700 rounded-md">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border border-gray-700 text-white rounded-md hover:bg-gray-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadFile}
                disabled={(uploadType === 'single' && !fileToUpload) || (uploadType === 'carousel' && multipleFiles.length === 0)}
                className={`px-4 py-2 rounded-md ${(uploadType === 'single' && !fileToUpload) || (uploadType === 'carousel' && multipleFiles.length === 0) ? 'bg-blue-700/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white transition-colors`}
              >
                <span className="flex items-center">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Sucesso */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-black rounded-lg border-2 border-green-500 p-8 w-full max-w-md shadow-2xl animate-[bounceIn_0.5s_ease-out]" 
               style={{
                 boxShadow: '0 0 20px rgba(34, 197, 94, 0.3), 0 0 40px rgba(34, 197, 94, 0.1)'
               }}>
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-900 mb-6 animate-[pulse_2s_infinite] relative">
                {/* Círculo de brilho */}
                <div className="absolute inset-0 rounded-full bg-green-500 opacity-30 animate-[ping_1.5s_ease-out_infinite]"></div>
                <CheckSquare className="h-10 w-10 text-green-400 z-10" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 animate-[slideInDown_0.5s_ease-out]">Upload Concluído com Sucesso!</h3>
              <p className="text-gray-300 mb-8 animate-[fadeIn_0.8s_ease-out]">Seu arquivo foi enviado e já está disponível para visualização.</p>
              
              <button
                onClick={() => setShowSuccessModal(false)}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-md hover:from-green-500 hover:to-green-400 transition-all duration-300 w-full font-medium shadow-lg animate-[fadeIn_1s_ease-out] hover:shadow-green-500/30"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Visualização */}
      {showPreviewModal && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
          <div className="bg-black rounded-lg border border-gray-800 p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white truncate">{selectedFile.name}</h3>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setSelectedFile(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              {/* Visualização baseada no tipo de arquivo */}
              {selectedFile.isCarousel ? (
                <div className="flex flex-col items-center justify-center">
                  {/* Carrossel de imagens */}
                  <div className="relative w-full max-w-3xl">
                    {/* Imagem principal */}
                    <div className="flex justify-center mb-4">
                      <img 
                        src={selectedFile.carouselUrls?.[0] || selectedFile.fileUrl} 
                        alt={`${selectedFile.name} - Imagem principal`} 
                        className="max-w-full max-h-[50vh] object-contain rounded-lg shadow-lg" 
                      />
                    </div>
                    
                    {/* Miniaturas do carrossel */}
                    <div className="flex justify-center space-x-2 mt-4 overflow-x-auto pb-2">
                      {selectedFile.carouselUrls?.map((url, index) => (
                        <button 
                          key={index}
                          onClick={() => {
                            // Trocar a imagem principal ao clicar na miniatura
                            const newFile = {...selectedFile};
                            if (newFile.carouselUrls) {
                              // Mover a imagem clicada para a primeira posição
                              const clickedUrl = newFile.carouselUrls[index];
                              newFile.carouselUrls = [
                                clickedUrl,
                                ...newFile.carouselUrls.filter((_, i) => i !== index)
                              ];
                              setSelectedFile(newFile);
                            }
                          }}
                          className="flex-shrink-0 border-2 rounded-md overflow-hidden transition-all hover:scale-105"
                          style={{
                            borderColor: url === selectedFile.carouselUrls?.[0] ? '#3b82f6' : 'transparent',
                          }}
                        >
                          <img 
                            src={url} 
                            alt={`Miniatura ${index + 1}`} 
                            className="w-16 h-16 object-cover" 
                          />
                        </button>
                      ))}
                    </div>
                    
                    <div className="text-center mt-2 text-gray-400 text-sm">
                      <span>Carrossel com {selectedFile.imageCount} imagens</span>
                    </div>
                  </div>
                </div>
              ) : selectedFile.fileType.startsWith('image/') && (
                <div className="flex justify-center">
                  <img 
                    src={selectedFile.fileUrl} 
                    alt={selectedFile.name} 
                    className="max-w-full max-h-[60vh] object-contain" 
                    onError={(e) => {
                      // Fallback para ícone se a imagem não carregar
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement!.innerHTML = `
                        <div class="text-center p-6 bg-gray-800 rounded-lg">
                          <p class="text-red-400 mb-2">Não foi possível carregar a imagem</p>
                          <p class="text-gray-400 text-sm">O arquivo pode estar indisponível ou corrompido.</p>
                        </div>
                      `;
                    }}
                  />
                </div>
              )}
              
              {selectedFile.fileType === 'application/pdf' && (
                <div className="flex justify-center h-[60vh]">
                  {selectedFile.fileUrl.startsWith('http') ? (
                    <iframe 
                      src={selectedFile.fileUrl} 
                      title={selectedFile.name} 
                      className="w-full h-full border-0" 
                      onError={() => {
                        // No fallback para iframe, pois o erro não é facilmente capturado
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full bg-gray-800 rounded-lg">
                      <FileText className="h-24 w-24 text-red-400 mb-4" />
                      <p className="text-white text-lg font-medium">Visualização de PDF não disponível</p>
                      <p className="text-gray-400 mt-2">Clique no botão de download abaixo para visualizar o arquivo.</p>
                    </div>
                  )}
                </div>
              )}
              
              {selectedFile.category === 'apresentacoes' && !selectedFile.fileType.startsWith('image/') && selectedFile.fileType !== 'application/pdf' && (
                <div className="flex justify-center h-[60vh]">
                  <div className="flex flex-col items-center justify-center w-full h-full bg-gray-800 rounded-lg">
                    <PresentationIcon className="h-24 w-24 text-yellow-400 mb-4" />
                    <p className="text-white text-lg font-medium">Visualização não disponível</p>
                    <p className="text-gray-400 mt-2">Clique no botão de download abaixo para visualizar a apresentação.</p>
                  </div>
                </div>
              )}
              
              {selectedFile.fileType.startsWith('video/') && (
                <div className="flex justify-center">
                  <video 
                    src={selectedFile.fileUrl} 
                    controls 
                    className="max-w-full max-h-[60vh]" 
                    onError={(e) => {
                      // Fallback para mensagem de erro
                      const target = e.target as HTMLVideoElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = `
                        <div class="text-center p-6 bg-gray-800 rounded-lg">
                          <p class="text-red-400 mb-2">Não foi possível reproduzir o vídeo</p>
                          <p class="text-gray-400 text-sm">O arquivo pode estar indisponível ou em formato não suportado pelo navegador.</p>
                        </div>
                      `;
                    }}
                  />
                </div>
              )}
            </div>
            
            <div className="bg-black rounded-lg border border-gray-800 p-4">
              <h4 className="text-lg font-medium text-white mb-2">Informações do Arquivo</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Nome:</p>
                  <p className="text-white">{selectedFile.name}</p>
                </div>
                
                <div>
                  <p className="text-gray-400 text-sm">Categoria:</p>
                  <p className="text-white">
                    {selectedFile.category === 'artes' && 'Artes Gráficas'}
                    {selectedFile.category === 'documentos' && 'Documentos PDF'}
                    {selectedFile.category === 'apresentacoes' && 'Apresentações'}
                    {selectedFile.category === 'videos' && 'Vídeos'}
                    {selectedFile.category === 'restrita' && 'Área Restrita'}
                  </p>
                </div>
                
                <div>
                  <p className="text-gray-400 text-sm">Tamanho:</p>
                  <p className="text-white">{formatFileSize(selectedFile.fileSize)}</p>
                </div>
                
                <div>
                  <p className="text-gray-400 text-sm">Data de Upload:</p>
                  <p className="text-white">{formatDate(selectedFile.createdAt)}</p>
                </div>
                
                <div className="md:col-span-2">
                  <p className="text-gray-400 text-sm">Descrição:</p>
                  <div className="text-white whitespace-pre-wrap">
                    {selectedFile.description ? (
                      <div dangerouslySetInnerHTML={{ 
                        __html: formatMarkdownText(selectedFile.description) 
                      }} />
                    ) : (
                      'Sem descrição'
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-4 space-x-3">
                {selectedFile.isCarousel && selectedFile.carouselUrls && selectedFile.carouselUrls.length > 0 && (
                  <button
                    onClick={() => handleDownloadAllCarouselImages(selectedFile)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span>Download Todas ({selectedFile.carouselUrls.length} imagens)</span>
                  </button>
                )}
                <a
                  href={selectedFile.fileUrl}
                  download={selectedFile.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
