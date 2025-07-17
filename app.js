// Global state management
const state = {
    wallet: {
      isConnected: false,
      address: null,
      network: null,
      balance: null
    },
    documents: [],
    selectedFile: null,
    web3: null,
    contract: null,
    isUploading: false,
    isVerifying: false
  };
  
  // Smart contract configuration
  const CONTRACT_ABI = [
    [
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "ipfsHash",
				"type": "string"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"name": "DocumentRegistered",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "ipfsHash",
				"type": "string"
			}
		],
		"name": "registerDocument",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "ipfsHash",
				"type": "string"
			}
		],
		"name": "documentIsRegistered",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "ipfsHash",
				"type": "string"
			}
		],
		"name": "verifyDocument",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]
  ];
  
  const CONTRACT_ADDRESS = '0xE25C62db0F3d9e4ecf5401e69F3047bC97AC437f';
  
  // Utility functions
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function getFileIcon(fileType) {
    if (fileType.includes('pdf')) return 'fas fa-file-pdf text-red-500';
    if (fileType.includes('image')) return 'fas fa-file-image text-blue-500';
    return 'fas fa-file-alt text-green-500';
  }
  
  function isValidIPFSHash(hash) {
    const cidv0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
    const cidv1Regex = /^b[A-Za-z2-7]{58}$/;
    return cidv0Regex.test(hash) || cidv1Regex.test(hash);
  }
  
  function getIPFSGatewayUrl(hash) {
    return `https://ipfs.io/ipfs/${hash}`;
  }
  
  // Toast notification system
  function showToast(title, description, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
      <div class="toast-header">
        <div class="toast-title">${title}</div>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="toast-description">${description}</div>
    `;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 5000);
  }
  
  // Web3 Service
  class Web3Service {
    async initializeWeb3() {
      if (typeof window.ethereum !== 'undefined') {
        state.web3 = new Web3(window.ethereum);
        state.contract = new state.web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        return state.web3;
      }
      throw new Error('MetaMask not detected');
    }
  
    async connectWallet() {
      try {
        if (!window.ethereum) {
          throw new Error('MetaMask not detected');
        }
  
        await this.initializeWeb3();
  
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
  
        if (accounts.length === 0) {
          throw new Error('No accounts found');
        }
  
        const address = accounts[0];
        const network = await this.getNetworkName();
        const balance = await this.getBalance(address);
  
        state.wallet = {
          isConnected: true,
          address,
          network,
          balance
        };
  
        updateWalletUI();
        loadRecentDocuments();
        
        showToast(
          "Wallet Connected",
          `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
          "success"
        );
  
        return state.wallet;
      } catch (error) {
        console.error('Wallet connection error:', error);
        showToast(
          "Connection Failed",
          error.message || "Failed to connect wallet",
          "error"
        );
        throw error;
      }
    }
  
    async getNetworkName() {
      if (!state.web3) throw new Error('Web3 not initialized');
  
      const chainId = await state.web3.eth.getChainId();
      const networks = {
        1: 'Ethereum Mainnet',
        11155111: 'Sepolia Testnet',
        137: 'Polygon Mainnet',
        80001: 'Polygon Mumbai'
      };
  
      return networks[Number(chainId)] || `Unknown Network (${chainId})`;
    }
  
    async getBalance(address) {
      if (!state.web3) throw new Error('Web3 not initialized');
  
      const balance = await state.web3.eth.getBalance(address);
      return state.web3.utils.fromWei(balance, 'ether');
    }
  
    async registerDocumentOnBlockchain(ipfsHash, fromAddress) {
      if (!state.contract) throw new Error('Contract not initialized');
  
      try {
        const gasEstimate = await state.contract.methods
          .registerDocument(ipfsHash)
          .estimateGas({ from: fromAddress });
  
        const transaction = await state.contract.methods
          .registerDocument(ipfsHash)
          .send({
            from: fromAddress,
            gas: Math.floor(gasEstimate * 1.2)
          });
  
        return transaction;
      } catch (error) {
        console.error('Blockchain registration error:', error);
        throw error;
      }
    }
  
    async verifyDocumentOnBlockchain(ipfsHash) {
      if (!state.contract) throw new Error('Contract not initialized');
  
      try {
        const result = await state.contract.methods.verifyDocument(ipfsHash).call();
        return {
          ipfsHash: result[0],
          owner: result[1],
          timestamp: result[2],
          exists: result[3]
        };
      } catch (error) {
        console.error('Blockchain verification error:', error);
        throw error;
      }
    }
  
    async isDocumentRegistered(ipfsHash) {
      if (!state.contract) throw new Error('Contract not initialized');
  
      try {
        return await state.contract.methods.documentIsRegistered(ipfsHash).call();
      } catch (error) {
        console.error('Document check error:', error);
        return false;
      }
    }
  }
  
  const web3Service = new Web3Service();
  
  // API Functions
  async function uploadToAPI(file, walletAddress) {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('walletAddress', walletAddress);
  
    const response = await fetch('http://localhost:5000/api/documents/upload', {
      method: 'POST',
      body: formData
    });
  
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }
  
    return response.json();
  }
  
  async function updateDocumentBlockchain(id, blockchainData) {
    const response = await fetch(`/api/documents/${id}/blockchain`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(blockchainData)
    });
  
    if (!response.ok) {
      throw new Error('Failed to update blockchain information');
    }
  
    return response.json();
  }
  
  async function verifyDocument(ipfsHash, verifierAddress) {
    const response = await fetch('/api/documents/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ipfsHash,
        verifierAddress
      })
    });
  
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Verification failed');
    }
  
    return response.json();
  }
  
  async function getDocumentsByWallet(walletAddress) {
    const response = await fetch(`http://localhost:5000/api/documents/wallet/${walletAddress}`);
    
    if (!response.ok) {
      throw new Error('Failed to retrieve documents');
    }
  
    return response.json();
  }
  
  // UI Update Functions
  function updateWalletUI() {
    const statusDot = document.getElementById('statusDot');
    const networkName = document.getElementById('networkName');
    const walletText = document.getElementById('walletText');
  
    if (state.wallet.isConnected) {
      statusDot.classList.add('connected');
      networkName.textContent = state.wallet.network || 'Connected';
      walletText.textContent = `${state.wallet.address.slice(0, 6)}...${state.wallet.address.slice(-4)}`;
    } else {
      statusDot.classList.remove('connected');
      networkName.textContent = 'Not Connected';
      walletText.textContent = 'Connect Wallet';
    }
  
    updateUploadButton();
    updateRecentDocuments();
  }
  
  function updateUploadButton() {
    const uploadBtn = document.getElementById('uploadBtn');
    const hasFile = state.selectedFile !== null;
    const isConnected = state.wallet.isConnected;
    
    uploadBtn.disabled = !hasFile || !isConnected || state.isUploading;
  }
  
  function updateSelectedFile() {
    const selectedFileDiv = document.getElementById('selectedFile');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
  
    if (state.selectedFile) {
      selectedFileDiv.style.display = 'block';
      fileName.textContent = state.selectedFile.name;
      fileSize.textContent = formatFileSize(state.selectedFile.size);
    } else {
      selectedFileDiv.style.display = 'none';
    }
  
    updateUploadButton();
  }
  
  function updateTransactionSteps(latestDocument = null) {
    const stepsContainer = document.getElementById('transactionSteps');
    
    let steps;
    if (!latestDocument) {
      steps = [
        {
          id: 'ipfs',
          title: 'Upload to IPFS',
          description: 'Document will be stored on IPFS',
          status: 'waiting'
        },
        {
          id: 'blockchain',
          title: 'Store hash on blockchain',
          description: 'Hash will be recorded on Ethereum',
          status: 'waiting'
        },
        {
          id: 'confirmation',
          title: 'Transaction confirmed',
          description: 'Blockchain confirmation received',
          status: 'waiting'
        }
      ];
    } else {
      steps = [
        {
          id: 'ipfs',
          title: 'Document uploaded to IPFS',
          description: 'File stored on decentralized network',
          status: 'completed',
          details: `Hash: ${latestDocument.ipfsHash.slice(0, 8)}...`
        }
      ];
  
      if (latestDocument.blockchainTxHash) {
        steps.push({
          id: 'blockchain',
          title: 'Hash stored on blockchain',
          description: 'Transaction confirmed on Ethereum',
          status: 'completed',
          details: `Tx: ${latestDocument.blockchainTxHash.slice(0, 8)}...`
        });
  
        steps.push({
          id: 'confirmation',
          title: 'Transaction confirmed',
          description: 'Document verification complete',
          status: 'completed',
          details: latestDocument.blockNumber ? `Block #${latestDocument.blockNumber.toLocaleString()}` : undefined
        });
      } else {
        steps.push({
          id: 'blockchain',
          title: 'Storing hash on blockchain...',
          description: 'Waiting for transaction confirmation',
          status: 'pending',
          details: 'Estimated gas: 45,000 gwei'
        });
  
        steps.push({
          id: 'confirmation',
          title: 'Transaction confirmed',
          description: 'Waiting for blockchain confirmation',
          status: 'waiting'
        });
      }
    }
  
    stepsContainer.innerHTML = steps.map((step, index) => `
      <div class="step ${step.status}">
        <div class="step-icon ${step.status}">
          ${step.status === 'completed' ? '<i class="fas fa-check"></i>' : 
            step.status === 'pending' ? '<i class="fas fa-spinner spinner"></i>' : 
            index + 1}
        </div>
        <div class="step-content">
          <p class="step-title">${step.title}</p>
          <p class="step-description">${step.details || step.description}</p>
        </div>
      </div>
    `).join('');
  }
  
  function updateDocumentReceipt(document = null) {
    const receiptContent = document.getElementById('receiptContent');
  
    if (!document) {
      receiptContent.innerHTML = `
        <div class="no-document">
          <i class="fas fa-file-upload no-document-icon"></i>
          <p>No document uploaded yet</p>
        </div>
      `;
      return;
    }
  
    receiptContent.innerHTML = `
      <div class="receipt-hash">
        <label>IPFS Hash</label>
        <div class="hash-display">
          <div class="hash-value">${document.ipfsHash}</div>
          <button class="btn btn-ghost" onclick="copyToClipboard('${document.ipfsHash}', 'IPFS Hash')">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </div>
  
      ${document.blockchainTxHash ? `
        <div class="receipt-hash">
          <label>Transaction Hash</label>
          <div class="hash-display">
            <div class="hash-value">${document.blockchainTxHash}</div>
            <button class="btn btn-ghost" onclick="copyToClipboard('${document.blockchainTxHash}', 'Transaction Hash')">
              <i class="fas fa-copy"></i>
            </button>
          </div>
        </div>
      ` : ''}
  
      <div class="receipt-grid">
        ${document.blockNumber ? `
          <div class="receipt-item">
            <label>Block Number</label>
            <p class="value">${document.blockNumber.toLocaleString()}</p>
          </div>
        ` : ''}
        <div class="receipt-item">
          <label>Timestamp</label>
          <p class="value">${new Date(document.createdAt).toLocaleString()}</p>
        </div>
      </div>
  
      <div class="receipt-buttons">
        <button class="btn btn-primary" onclick="openIPFS('${document.ipfsHash}')">
          <i class="fas fa-external-link-alt"></i>
          View on IPFS
        </button>
        <button class="btn btn-outline" onclick="openEtherscan('${document.blockchainTxHash || ''}')" 
                ${!document.blockchainTxHash ? 'disabled' : ''}>
          <i class="fas fa-link"></i>
          Etherscan
        </button>
      </div>
    `;
  }
  
  function updateRecentDocuments() {
    const recentDocuments = document.getElementById('recentDocuments');
  
    if (!state.wallet.isConnected) {
      recentDocuments.innerHTML = `
        <div class="no-wallet">
          <i class="fas fa-wallet no-wallet-icon"></i>
          <p>Connect your wallet to view documents</p>
        </div>
      `;
      return;
    }
  
    if (state.documents.length === 0) {
      recentDocuments.innerHTML = `
        <div class="no-document">
          <i class="fas fa-file no-document-icon"></i>
          <p>No documents uploaded yet</p>
        </div>
      `;
      return;
    }
  
    recentDocuments.innerHTML = `
      <div class="document-list">
        ${state.documents.slice(0, 3).map(doc => `
          <div class="document-item" onclick="openIPFS('${doc.ipfsHash}')">
            <div class="document-icon">
              <i class="${getFileIcon(doc.fileType)}"></i>
            </div>
            <div class="document-info">
              <p class="document-name">${doc.filename}</p>
              <p class="document-meta">
                ${new Date(doc.createdAt).toLocaleDateString()}
                ${doc.blockNumber ? ` • Block #${doc.blockNumber.toLocaleString()}` : ''}
              </p>
            </div>
            <div class="document-status">
              <span class="document-status-dot ${doc.status}"></span>
              <button class="btn btn-ghost">
                <i class="fas fa-external-link-alt"></i>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Event Handlers
  async function handleWalletConnect() {
    const connectBtn = document.getElementById('connectWallet');
    
    if (state.wallet.isConnected) {
      return;
    }
  
    connectBtn.disabled = true;
    document.getElementById('walletText').textContent = 'Connecting...';
  
    try {
      await web3Service.connectWallet();
    } catch (error) {
      console.error('Wallet connection failed:', error);
    } finally {
      connectBtn.disabled = false;
      updateWalletUI();
    }
  }
  
  function handleFileSelect(file) {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const maxSize = 10 * 1024 * 1024; // 10MB
  
    if (!allowedTypes.includes(file.type)) {
      showToast(
        "Invalid File Type",
        "Only PDF, JPG, and PNG files are allowed",
        "error"
      );
      return;
    }
  
    if (file.size > maxSize) {
      showToast(
        "File Too Large",
        "File size must be less than 10MB",
        "error"
      );
      return;
    }
  
    state.selectedFile = file;
    updateSelectedFile();
  }
  
  function handleDrop(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.remove('dragging');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }
  
  function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.add('dragging');
  }
  
  function handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.remove('dragging');
  }
  
  function handleRemoveFile() {
    state.selectedFile = null;
    document.getElementById('fileInput').value = '';
    updateSelectedFile();
  }
  
  async function handleUpload() {
    if (!state.selectedFile || !state.wallet.isConnected || state.isUploading) {
      return;
    }
  
    state.isUploading = true;
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadBtnText = document.getElementById('uploadBtnText');
    
    uploadBtn.disabled = true;
    uploadBtnText.innerHTML = '<i class="fas fa-spinner spinner"></i> Uploading...';
  
    try {
      // Upload to IPFS via API
      const uploadResult = await uploadToAPI(state.selectedFile, state.wallet.address);
      
      showToast(
        "File Uploaded to IPFS",
        `Hash: ${uploadResult.ipfsHash.slice(0, 8)}...`,
        "success"
      );
  
      updateDocumentReceipt(uploadResult);
      updateTransactionSteps(uploadResult);
  
      // Register on blockchain
      try {
        const transaction = await web3Service.registerDocumentOnBlockchain(
          uploadResult.ipfsHash,
          state.wallet.address
        );
  
        // Update document with blockchain info
        const updatedDocument = await updateDocumentBlockchain(uploadResult.id, {
          blockchainTxHash: transaction.transactionHash,
          blockNumber: transaction.blockNumber,
          status: 'confirmed'
        });
  
        showToast(
          "Document Registered on Blockchain",
          `Transaction: ${transaction.transactionHash.slice(0, 8)}...`,
          "success"
        );
  
        updateDocumentReceipt(updatedDocument);
        updateTransactionSteps(updatedDocument);
        loadRecentDocuments();
  
      } catch (blockchainError) {
        console.error('Blockchain registration failed:', blockchainError);
        showToast(
          "Blockchain Registration Failed",
          blockchainError.message || "Unknown error",
          "error"
        );
      }
  
      state.selectedFile = null;
      updateSelectedFile();
  
    } catch (error) {
      console.error('Upload failed:', error);
      showToast(
        "Upload Failed",
        error.message || "Unknown error occurred",
        "error"
      );
    } finally {
      state.isUploading = false;
      uploadBtn.disabled = false;
      uploadBtnText.innerHTML = '<i class="fas fa-shield-alt"></i> Upload to IPFS & Store Hash';
      updateUploadButton();
    }
  }
  
  async function handleVerify() {
    const ipfsHashInput = document.getElementById('ipfsHash');
    const verifyBtn = document.getElementById('verifyBtn');
    const verifyBtnText = document.getElementById('verifyBtnText');
    const verificationResult = document.getElementById('verificationResult');
  
    const ipfsHash = ipfsHashInput.value.trim();
  
    if (!ipfsHash) {
      showToast(
        "Invalid Input",
        "Please enter an IPFS hash",
        "error"
      );
      return;
    }
  
    if (!isValidIPFSHash(ipfsHash)) {
      showToast(
        "Invalid IPFS Hash",
        "Please enter a valid IPFS hash",
        "error"
      );
      return;
    }
  
    if (!state.wallet.isConnected) {
      showToast(
        "Wallet Not Connected",
        "Please connect your wallet first",
        "error"
      );
      return;
    }
  
    state.isVerifying = true;
    verifyBtn.disabled = true;
    verifyBtnText.innerHTML = '<i class="fas fa-spinner spinner"></i>';
  
    try {
      const result = await verifyDocument(ipfsHash, state.wallet.address);
      
      const isValid = result.isValid;
      const cssClass = isValid ? 'valid' : 'invalid';
      const statusIcon = isValid ? 'fas fa-check' : 'fas fa-times';
      const statusTitle = isValid ? 'Document Verified ✓' : 'Document Not Found ✗';
      const statusDesc = isValid ? 
        'This document exists on the blockchain' : 
        'This document is not registered';
  
      verificationResult.className = `verification-result ${cssClass}`;
      verificationResult.style.display = 'block';
      
      verificationResult.innerHTML = `
        <div class="verification-header">
          <div class="verification-status">
            <div class="verification-status-icon ${cssClass}">
              <i class="${statusIcon}"></i>
            </div>
            <div>
              <h3>${statusTitle}</h3>
              <p>${statusDesc}</p>
            </div>
          </div>
          <button class="btn btn-ghost" onclick="clearVerificationResult()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        ${isValid && result.document ? `
          <div class="verification-details">
            <div class="verification-detail">
              <span class="label">Stored:</span>
              <span class="value">${new Date(result.document.createdAt).toLocaleDateString()}</span>
            </div>
            ${result.document.blockNumber ? `
              <div class="verification-detail">
                <span class="label">Block:</span>
                <span class="value">#${result.document.blockNumber.toLocaleString()}</span>
              </div>
            ` : ''}
            <div class="verification-detail">
              <span class="label">Owner:</span>
              <span class="value">${result.document.walletAddress.slice(0, 6)}...${result.document.walletAddress.slice(-4)}</span>
            </div>
            <div class="verification-detail">
              <span class="label">Status:</span>
              <span class="value">${result.document.status === 'confirmed' ? 'Authentic' : 'Pending'}</span>
            </div>
          </div>
        ` : ''}
      `;
  
      if (isValid) {
        showToast(
          "Document Verified ✓",
          "This document exists on the blockchain",
          "success"
        );
      } else {
        showToast(
          "Document Not Found",
          "This document is not registered on the blockchain",
          "error"
        );
      }
  
    } catch (error) {
      console.error('Verification failed:', error);
      showToast(
        "Verification Failed",
        error.message || "Unknown error occurred",
        "error"
      );
    } finally {
      state.isVerifying = false;
      verifyBtn.disabled = false;
      verifyBtnText.textContent = 'Verify';
    }
  }
  
  async function loadRecentDocuments() {
    if (!state.wallet.isConnected || !state.wallet.address) {
      return;
    }
  
    try {
      state.documents = await getDocumentsByWallet(state.wallet.address);
      updateRecentDocuments();
      
      // Update receipt with latest document if any
      if (state.documents.length > 0) {
        updateDocumentReceipt(state.documents[0]);
        updateTransactionSteps(state.documents[0]);
      }
    } catch (error) {
      console.error('Failed to load recent documents:', error);
    }
  }
  
  // Helper functions for UI actions
  function clearVerificationResult() {
    document.getElementById('verificationResult').style.display = 'none';
    document.getElementById('ipfsHash').value = '';
  }
  
  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(
        "Copied!",
        `${label} copied to clipboard`,
        "success"
      );
    } catch (error) {
      showToast(
        "Copy Failed",
        "Unable to copy to clipboard",
        "error"
      );
    }
  }
  
  function openIPFS(hash) {
    window.open(getIPFSGatewayUrl(hash), '_blank');
  }
  
  function openEtherscan(txHash) {
    if (txHash) {
      window.open(`https://etherscan.io/tx/${txHash}`, '_blank');
    }
  }
  
  // Initialize the application
  document.addEventListener('DOMContentLoaded', function() {
    // Wallet connection
    document.getElementById('connectWallet').addEventListener('click', handleWalletConnect);
  
    // File upload
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
  
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('drop', handleDrop);
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
  
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  
    document.getElementById('removeFile').addEventListener('click', handleRemoveFile);
    document.getElementById('uploadBtn').addEventListener('click', handleUpload);
  
    // Document verification
    document.getElementById('verifyBtn').addEventListener('click', handleVerify);
  
    // Check if wallet is already connected
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
        if (accounts.length > 0) {
          web3Service.connectWallet().catch(console.error);
        }
      });
  
      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          state.wallet = {
            isConnected: false,
            address: null,
            network: null,
            balance: null
          };
          state.documents = [];
          updateWalletUI();
        } else {
          web3Service.connectWallet().catch(console.error);
        }
      });
  
      // Listen for network changes
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  
    // Initialize UI
    updateWalletUI();
    updateTransactionSteps();
  });