"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.disableAuthUser = exports.deleteAuthUser = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Função para excluir um usuário do Firebase Authentication
exports.deleteAuthUser = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    var _a;
    // Verificar se o usuário está autenticado e é um administrador
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'O usuário deve estar autenticado para realizar esta ação.');
    }
    // Verificar se o usuário é um administrador (você deve implementar essa verificação)
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.roleKey) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem excluir usuários.');
    }
    // Verificar se o UID foi fornecido
    if (!data.uid) {
        throw new functions.https.HttpsError('invalid-argument', 'O UID do usuário a ser excluído é obrigatório.');
    }
    try {
        // Excluir o usuário do Firebase Authentication
        await admin.auth().deleteUser(data.uid);
        return { success: true, message: 'Usuário excluído com sucesso.' };
    }
    catch (error) {
        console.error('Erro ao excluir usuário:', error);
        throw new functions.https.HttpsError('internal', 'Erro ao excluir usuário do Firebase Authentication.');
    }
});
// Função para desativar/ativar um usuário no Firebase Authentication
exports.disableAuthUser = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    var _a;
    // Verificar se o usuário está autenticado e é um administrador
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'O usuário deve estar autenticado para realizar esta ação.');
    }
    // Verificar se o usuário é um administrador
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.roleKey) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem bloquear/desbloquear usuários.');
    }
    // Verificar se o UID e o status de bloqueio foram fornecidos
    if (!data.uid || data.disabled === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'O UID do usuário e o status de bloqueio são obrigatórios.');
    }
    try {
        // Atualizar o status de bloqueio do usuário no Firebase Authentication
        await admin.auth().updateUser(data.uid, { disabled: data.disabled });
        return {
            success: true,
            message: `Usuário ${data.disabled ? 'bloqueado' : 'desbloqueado'} com sucesso.`
        };
    }
    catch (error) {
        console.error('Erro ao atualizar status de bloqueio do usuário:', error);
        throw new functions.https.HttpsError('internal', 'Erro ao atualizar status de bloqueio do usuário no Firebase Authentication.');
    }
});
//# sourceMappingURL=auth.js.map