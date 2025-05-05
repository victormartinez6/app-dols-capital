import axios from 'axios';

interface CNPJResponse {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  data_abertura: string;
  situacao_cadastral: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
  };
}

export async function searchCNPJ(cnpj: string): Promise<CNPJResponse | null> {
  try {
    const formattedCnpj = cnpj.replace(/\D/g, '');
    
    if (formattedCnpj.length !== 14) {
      return null;
    }

    const response = await axios.get(`https://publica.cnpj.ws/cnpj/${formattedCnpj}`);
    
    if (response.data) {
      const estabelecimento = response.data.estabelecimento || {};
      
      return {
        razao_social: response.data.razao_social,
        nome_fantasia: estabelecimento.nome_fantasia || '',
        cnpj: estabelecimento.cnpj || '',
        data_abertura: estabelecimento.data_inicio_atividade || '',
        situacao_cadastral: estabelecimento.situacao_cadastral || '',
        endereco: {
          cep: estabelecimento.cep || '',
          logradouro: estabelecimento.logradouro || '',
          numero: estabelecimento.numero || '',
          complemento: estabelecimento.complemento || '',
          bairro: estabelecimento.bairro || '',
          municipio: estabelecimento.cidade?.nome || '',
          uf: estabelecimento.estado?.sigla || '',
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ao buscar CNPJ:', error);
    return null;
  }
}