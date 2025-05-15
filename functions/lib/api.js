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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
// Configuração do CORS
const corsMiddleware = (0, cors_1.default)({
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});
// API para excluir usuário do Firebase Authentication
exports.deleteUser = functions.https.onRequest((req, res) => {
    return corsMiddleware(req, res, async () => {
        var _a;
        try {
            // Verificar método
            if (req.method !== 'DELETE') {
                return res.status(405).json({ error: 'Método não permitido. Use DELETE.' });
            }
            // Verificar autenticação
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Não autorizado. Token não fornecido.' });
            }
            const idToken = authHeader.split('Bearer ')[1];
            try {
                // Verificar token e obter usuário
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                // Verificar se o usuário é um administrador
                const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
                if (!userDoc.exists || ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.roleKey) !== 'admin') {
                    return res.status(403).json({ error: 'Permissão negada. Apenas administradores podem excluir usuários.' });
                }
                // Obter o UID do usuário a ser excluído
                const { uid } = req.query;
                if (!uid || typeof uid !== 'string') {
                    return res.status(400).json({ error: 'UID do usuário não fornecido ou inválido.' });
                }
                // Excluir o usuário
                await admin.auth().deleteUser(uid);
                return res.status(200).json({
                    success: true,
                    message: 'Usuário excluído com sucesso da autenticação do Firebase.'
                });
            }
            catch (verifyError) {
                console.error('Erro ao verificar token:', verifyError);
                return res.status(401).json({ error: 'Token inválido ou expirado.' });
            }
        }
        catch (error) {
            console.error('Erro ao processar requisição:', error);
            return res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    });
});
//# sourceMappingURL=api.js.map