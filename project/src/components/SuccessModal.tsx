import { CheckCircle, ArrowRight } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  buttonText?: string;
}

export default function SuccessModal({ 
  isOpen, 
  onClose, 
  message, 
  buttonText = "Ir para o Dashboard" 
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-gray-800 rounded-lg p-6 max-w-sm w-full">
        <div className="flex flex-col items-center text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Sucesso!</h3>
          <p className="text-gray-300 mb-6">{message}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100 transition-colors flex items-center"
          >
            {buttonText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}