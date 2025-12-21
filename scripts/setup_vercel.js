// setup-vercel.js
// Script automático para configurar o projeto para deploy no Vercel

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🚀 Configurando projeto para Vercel...\n');

// 1. Criar vercel.json
const vercelConfig = {
  version: 2,
  builds: [
    {
      src: "index.js",
      use: "@vercel/node"
    }
  ],
  routes: [
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
  ]
};

console.log('📝 Criando vercel.json...');
fs.writeFileSync('vercel.json', JSON.stringify(vercelConfig, null, 2));
console.log('✅ vercel.json criado!\n');

// 2. Atualizar/criar package.json
console.log('📝 Configurando package.json...');
let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
} catch (e) {
  packageJson = {};
}

packageJson.name = packageJson.name || "elfetor-hardest-demons";
packageJson.version = packageJson.version || "1.0.0";
packageJson.description = "ELFetor Hardest Demons List";
packageJson.main = "index.js";
packageJson.scripts = {
  start: "node index.js",
  dev: "node index.js"
};
packageJson.dependencies = packageJson.dependencies || {};
if (!packageJson.dependencies.express) {
  packageJson.dependencies.express = "^4.18.2";
}
packageJson.engines = {
  node: "20.x"
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ package.json configurado!\n');

// 3. Criar .gitignore
console.log('📝 Criando .gitignore...');
const gitignore = `node_modules/
.env
*.log
.DS_Store
.vercel
`;
fs.writeFileSync('.gitignore', gitignore);
console.log('✅ .gitignore criado!\n');

// 4. Criar README.md
console.log('📝 Criando README.md...');
const readme = `# ELFetor Hardest Demons

Site de lista dos demons mais difíceis completados por ELFetor no Geometry Dash.

## 🚀 Deploy

Este projeto está configurado para deploy automático no Vercel.

## 🛠️ Tecnologias

- Node.js
- Express.js
- Bootstrap 5

## 📦 Instalação Local

\`\`\`bash
npm install
npm start
\`\`\`

Acesse: http://localhost:3030/home

## 🌐 Deploy no Vercel

1. Conecte seu repositório GitHub ao Vercel
2. O deploy será automático a cada push

## 📝 Licença

Projeto pessoal - ELFetor
`;
fs.writeFileSync('README.md', readme);
console.log('✅ README.md criado!\n');

// 5. Verificar se node_modules existe
console.log('📦 Verificando dependências...');
if (!fs.existsSync('node_modules')) {
  console.log('⏳ Instalando dependências (isso pode demorar um pouco)...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependências instaladas!\n');
  } catch (e) {
    console.log('⚠️  Erro ao instalar dependências. Execute "npm install" manualmente.\n');
  }
} else {
  console.log('✅ Dependências já instaladas!\n');
}

// 6. Inicializar Git (se necessário)
console.log('🔧 Configurando Git...');
try {
  if (!fs.existsSync('.git')) {
    execSync('git init', { stdio: 'inherit' });
    console.log('✅ Git inicializado!\n');
  } else {
    console.log('✅ Git já está inicializado!\n');
  }
} catch (e) {
  console.log('⚠️  Erro ao inicializar Git. Certifique-se que o Git está instalado.\n');
}

// 7. Instruções finais
console.log('\n' + '='.repeat(60));
console.log('🎉 CONFIGURAÇÃO CONCLUÍDA!');
console.log('='.repeat(60) + '\n');

console.log('📋 PRÓXIMOS PASSOS:\n');
console.log('1️⃣  Criar repositório no GitHub:');
console.log('   → Acesse: https://github.com/new');
console.log('   → Nome: elfetor-hardest-demons');
console.log('   → Clique em "Create repository"\n');

console.log('2️⃣  Subir código para o GitHub:');
console.log('   Execute estes comandos:\n');
console.log('   git add .');
console.log('   git commit -m "Initial commit - ELFetor Hardest Demons"');
console.log('   git branch -M main');
console.log('   git remote add origin https://github.com/SEU_USUARIO/elfetor-hardest-demons.git');
console.log('   git push -u origin main\n');

console.log('3️⃣  Deploy no Vercel:');
console.log('   → Acesse: https://vercel.com/new');
console.log('   → Faça login com GitHub');
console.log('   → Selecione o repositório "elfetor-hardest-demons"');
console.log('   → Clique em "Deploy"\n');

console.log('4️⃣  Seu site estará no ar em:');
console.log('   → https://elfetor-hardest-demons.vercel.app\n');

console.log('='.repeat(60));
console.log('\n✨ Dica: Todo push no GitHub = Deploy automático!\n');

console.log('📄 Arquivos criados:');
console.log('   ✓ vercel.json');
console.log('   ✓ package.json');
console.log('   ✓ .gitignore');
console.log('   ✓ README.md\n');