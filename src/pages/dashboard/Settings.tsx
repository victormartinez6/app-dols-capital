import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Building2, Plus, Edit, Trash2 } from 'lucide-react';
import BankSettings from './settings/BankSettings';
import { useAuth } from '../../contexts/AuthContext';

// Tipo para os dados do banco
type Bank = {
  id: string;
  companyName: string;
  cnpj: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  commission: string;
  createdAt?: any;
  updatedAt?: any;
};

export default function Settings() {
  const { user } = useAuth();
  const [showBankForm, setShowBankForm] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBank, setEditingBank] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carregar lista de bancos
  const loadBanks = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Tentando carregar bancos. Usuário:', user?.email, 'Perfil:', user?.roleKey);
      
      const banksQuery = query(collection(db, 'banks'), orderBy('companyName'));
      const snapshot = await getDocs(banksQuery);
      
      console.log('Bancos encontrados:', snapshot.docs.length);
      
      const banksList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bank[];
      
      setBanks(banksList);
    } catch (error) {
      console.error('Erro ao carregar bancos:', error);
      setError(`Erro ao carregar bancos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadBanks();
    }
  }, [user]);

  // Excluir banco
  const deleteBank = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'banks', id));
      setDeleteConfirmId(null);
      loadBanks();
    } catch (error) {
      console.error('Erro ao excluir banco:', error);
      setError(`Erro ao excluir banco: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  // Editar banco
  const editBank = (bankId: string) => {
    setEditingBank(bankId);
    setShowBankForm(true);
  };

  // Adicionar novo banco
  const addNewBank = () => {
    setEditingBank(null);
    setShowBankForm(true);
  };

  // Voltar para a lista de bancos
  const backToList = () => {
    setShowBankForm(false);
    setEditingBank(null);
    loadBanks();
  };

  // Renderizar conteúdo principal
  const renderContent = () => {
    if (!user) {
      return (
        <div className="p-6">
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
            <p className="text-sm text-red-500">Usuário não autenticado. Por favor, faça login novamente.</p>
          </div>
        </div>
      );
    }

    // Verificar permissões usando roleKey em vez de role
    if (user.roleKey !== 'admin' && user.roleKey !== 'manager') {
      console.log('Acesso negado. Perfil do usuário:', user.roleKey);
      return (
        <div className="p-6">
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
            <p className="text-sm text-red-500">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      );
    }

    if (showBankForm) {
      return <BankSettings bankId={editingBank} onSaved={backToList} />;
    }

    return (
      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500 rounded-lg p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Bancos Cadastrados</h3>
          <button
            onClick={addNewBank}
            className="flex items-center px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100"
          >
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Novo Banco
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : (
          <>
            {/* Tabela para desktop */}
            <div className="hidden md:block bg-black border border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                        Banco
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                        CNPJ
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                        Comissão
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                        Contato
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-black divide-y divide-gray-700">
                    {banks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-white">
                          Nenhum banco cadastrado. Clique em "Cadastrar Novo Banco" para começar.
                        </td>
                      </tr>
                    ) : (
                      banks.map((bank) => (
                        <tr key={bank.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-white">{bank.companyName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                            {bank.cnpj && bank.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                            {bank.commission ? `${bank.commission}%` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">{bank.contactName}</div>
                            <div className="text-xs text-gray-400">{bank.contactEmail}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                            <div className="flex space-x-4">
                              {deleteConfirmId === bank.id ? (
                                <div className="flex items-center space-x-2">
                                  <span className="text-gray-400 text-xs">Confirmar exclusão?</span>
                                  <button
                                    onClick={() => deleteBank(bank.id)}
                                    className="text-rose-400 hover:text-rose-300 hover:drop-shadow-[0_0_4px_rgba(251,113,133,0.6)] transition-all"
                                  >
                                    Sim
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="text-gray-400 hover:text-gray-300"
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => editBank(bank.id)}
                                    className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                                    title="Editar"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(bank.id)}
                                    className="text-rose-400 hover:text-rose-300 hover:drop-shadow-[0_0_4px_rgba(251,113,133,0.6)] transition-all"
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Cards para mobile */}
            <div className="md:hidden space-y-4">
              {banks.length === 0 ? (
                <div className="bg-black border border-gray-700 rounded-lg p-6 text-center text-white">
                  Nenhum banco cadastrado. Clique em "Cadastrar Novo Banco" para começar.
                </div>
              ) : (
                banks.map((bank) => (
                  <div key={bank.id} className="bg-black border border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-sm font-medium text-white">{bank.companyName}</div>
                      <div className="flex space-x-2">
                        {deleteConfirmId === bank.id ? (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => deleteBank(bank.id)}
                              className="text-rose-400 hover:text-rose-300 hover:drop-shadow-[0_0_4px_rgba(251,113,133,0.6)] transition-all"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-gray-400 hover:text-gray-300"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => editBank(bank.id)}
                              className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(bank.id)}
                              className="text-rose-400 hover:text-rose-300 hover:drop-shadow-[0_0_4px_rgba(251,113,133,0.6)] transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-gray-400">CNPJ</div>
                        <div className="text-white">
                          {bank.cnpj && bank.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Comissão</div>
                        <div className="text-white">{bank.commission ? `${bank.commission}%` : '-'}</div>
                      </div>
                      <div className="col-span-2 mt-2">
                        <div className="text-gray-400">Contato</div>
                        <div className="text-white">{bank.contactName}</div>
                        <div className="text-xs text-gray-400">{bank.contactEmail}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-black text-white rounded-lg shadow">
      <div className="flex items-center justify-between p-6 border-b border-gray-800">
        <div className="flex items-center">
          <Building2 className="h-6 w-6 mr-3" />
          <h2 className="text-2xl font-semibold">Configurações de Bancos</h2>
        </div>
        
        {showBankForm && (
          <button
            onClick={backToList}
            className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-800"
          >
            Voltar para Lista
          </button>
        )}
      </div>
      
      {renderContent()}
    </div>
  );
}