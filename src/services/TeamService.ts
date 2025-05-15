import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TeamData {
  id?: string;
  name: string;
  teamCode: string;
  managerId?: string;
  managerName?: string;
  members?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export const teamService = {
  /**
   * Busca uma equipe pelo ID
   */
  async getTeamById(teamId: string | null | undefined): Promise<TeamData | null> {
    if (!teamId) return null;
    
    try {
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (teamDoc.exists()) {
        return { id: teamDoc.id, ...teamDoc.data() } as TeamData;
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar equipe:', error);
      return null;
    }
  },

  /**
   * Busca uma equipe pelo código
   */
  async getTeamByCode(teamCode: string | null | undefined): Promise<TeamData | null> {
    if (!teamCode) return null;
    
    try {
      const teamsQuery = query(
        collection(db, 'teams'),
        where('teamCode', '==', teamCode)
      );
      
      const querySnapshot = await getDocs(teamsQuery);
      if (!querySnapshot.empty) {
        const teamDoc = querySnapshot.docs[0];
        return { id: teamDoc.id, ...teamDoc.data() } as TeamData;
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar equipe pelo código:', error);
      return null;
    }
  },

  /**
   * Busca o nome do gerente pelo ID
   */
  async getManagerName(managerId: string | null | undefined): Promise<string> {
    if (!managerId) return '';
    
    try {
      const managerDoc = await getDoc(doc(db, 'users', managerId));
      if (managerDoc.exists()) {
        const data = managerDoc.data();
        // Tenta buscar o nome do gerente em diferentes campos possíveis
        return data.name || 
               data.displayName || 
               data.fullName || 
               '';
      }
      return '';
    } catch (error) {
      console.error('Erro ao buscar nome do gerente:', error);
      return '';
    }
  },

  /**
   * Atualiza ou cria uma equipe
   */
  async saveTeam(teamData: TeamData): Promise<string | null> {
    if (!teamData.teamCode) return null;
    
    try {
      // Buscar o nome do gerente se temos um managerId e não temos o nome
      if (teamData.managerId && !teamData.managerName) {
        teamData.managerName = await this.getManagerName(teamData.managerId);
      }
      
      // Se temos um ID, atualizar a equipe existente
      if (teamData.id) {
        const teamRef = doc(db, 'teams', teamData.id);
        await updateDoc(teamRef, {
          ...teamData,
          updatedAt: serverTimestamp()
        });
        return teamData.id;
      } 
      
      // Caso contrário, criar uma nova equipe
      else {
        // Verificar se já existe uma equipe com o mesmo código
        const existingTeam = await this.getTeamByCode(teamData.teamCode);
        if (existingTeam && existingTeam.id) {
          // Se existir, atualizar a equipe existente
          const teamRef = doc(db, 'teams', existingTeam.id);
          await updateDoc(teamRef, {
            ...teamData,
            updatedAt: serverTimestamp()
          });
          return existingTeam.id;
        } else {
          // Se não existir, criar uma nova equipe
          const teamsCollection = collection(db, 'teams');
          const teamRef = doc(teamsCollection);
          await setDoc(teamRef, {
            ...teamData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          return teamRef.id;
        }
      }
    } catch (error) {
      console.error('Erro ao salvar equipe:', error);
      throw error;
    }
  },

  /**
   * Atualiza o gerente de uma equipe
   */
  async updateTeamManager(teamId: string | null | undefined, managerId: string | null | undefined, managerName: string | null | undefined): Promise<void> {
    if (!teamId || !managerId || !managerName) return;
    
    try {
      const teamRef = doc(db, 'teams', teamId);
      await updateDoc(teamRef, {
        managerId,
        managerName,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erro ao atualizar gerente da equipe:', error);
      throw error;
    }
  }
};
