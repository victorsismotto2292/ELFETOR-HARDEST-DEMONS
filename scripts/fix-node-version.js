// fix-node-version.js
// Script para corrigir a versão do Node.js

const fs = require('fs');

console.log('\n🔧 Corrigindo versão do Node.js...\n');

// Atualizar package.json
console.log('📝 Atualizando package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.engines = {
  node: "20.x"
};
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ package.json atualizado para Node.js 20.x\n');

// Atualizar vercel.json (adicionar configuração de runtime)
console.log('📝 Atualizando vercel.json...');
let vercelJson;
try {
  vercelJson = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
} catch (e) {
  vercelJson = {
    version: 2,
    builds: [],
    routes: []
  };
}

// Garantir que builds existe
if (!vercelJson.builds) vercelJson.builds = [];

// Atualizar ou adicionar configuração do Node.js
const nodeBuildIndex = vercelJson.builds.findIndex(b => b.src === 'index.js');
if (nodeBuildIndex !== -1) {
  vercelJson.builds[nodeBuildIndex] = {
    src: "index.js",
    use: "@vercel/node",
    config: {
      runtime: "nodejs20.x"
    }
  };
} else {
  vercelJson.builds.push({
    src: "index.js",
    use: "@vercel/node",
    config: {
      runtime: "nodejs20.x"
    }
  });
}

// Garantir rotas corretas
if (!vercelJson.routes || vercelJson.routes.length === 0) {
  vercelJson.routes = [
    {
      src: "/home",
      dest: "index.js"
    },
    {
      src: "/style/(.*)",
      dest: "/style/$1"
    },
    {
      src: "/img/(.*)",
      dest: "/img/$1"
    },
    {
      src: "/public/(.*)",
      dest: "/public/$1"
    },
    {
      src: "/(.*)",
      dest: "index.js"
    }
  ];
}

fs.writeFileSync('vercel.json', JSON.stringify(vercelJson, null, 2));
console.log('✅ vercel.json atualizado!\n');

console.log('=' .repeat(60));
console.log('🎉 CORREÇÃO CONCLUÍDA!');
console.log('=' .repeat(60) + '\n');

console.log('📋 PRÓXIMOS PASSOS:\n');
console.log('1️⃣  Fazer commit das alterações:\n');
console.log('   git add .');
console.log('   git commit -m "Fix: Update Node.js version to 20.x"');
console.log('   git push\n');

console.log('2️⃣  Aguarde 1-2 minutos...');
console.log('   O Vercel vai fazer o deploy automaticamente! 🚀\n');

console.log('3️⃣  Verifique o deploy:');
console.log('   → Acesse: https://vercel.com/dashboard\n');

console.log('=' .repeat(60) + '\n');

console.log('✨ Seu site estará funcionando em breve!\n');