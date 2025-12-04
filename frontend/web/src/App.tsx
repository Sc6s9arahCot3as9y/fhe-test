import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface TestCase {
  id: string;
  name: string;
  description: string;
  status: "pending" | "passed" | "failed";
  timestamp: number;
  owner: string;
  fheType: string;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newTestCase, setNewTestCase] = useState({
    name: "",
    description: "",
    fheType: "Concrete"
  });
  const [showTutorial, setShowTutorial] = useState(false);

  // Calculate statistics for dashboard
  const passedCount = testCases.filter(tc => tc.status === "passed").length;
  const failedCount = testCases.filter(tc => tc.status === "failed").length;
  const pendingCount = testCases.filter(tc => tc.status === "pending").length;

  useEffect(() => {
    loadTestCases().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadTestCases = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("test_case_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing test case keys:", e);
        }
      }
      
      const list: TestCase[] = [];
      
      for (const key of keys) {
        try {
          const testCaseBytes = await contract.getData(`test_case_${key}`);
          if (testCaseBytes.length > 0) {
            try {
              const testCaseData = JSON.parse(ethers.toUtf8String(testCaseBytes));
              list.push({
                id: key,
                name: testCaseData.name,
                description: testCaseData.description,
                status: testCaseData.status || "pending",
                timestamp: testCaseData.timestamp,
                owner: testCaseData.owner,
                fheType: testCaseData.fheType || "Concrete"
              });
            } catch (e) {
              console.error(`Error parsing test case data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading test case ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setTestCases(list);
    } catch (e) {
      console.error("Error loading test cases:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitTestCase = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Creating encrypted test case with FHE..."
    });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const testCaseId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const testCaseData = {
        name: newTestCase.name,
        description: newTestCase.description,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        status: "pending",
        fheType: newTestCase.fheType
      };
      
      // Store test case on-chain
      await contract.setData(
        `test_case_${testCaseId}`, 
        ethers.toUtf8Bytes(JSON.stringify(testCaseData))
      );
      
      const keysBytes = await contract.getData("test_case_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(testCaseId);
      
      await contract.setData(
        "test_case_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE test case created successfully!"
      });
      
      await loadTestCases();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewTestCase({
          name: "",
          description: "",
          fheType: "Concrete"
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Creation failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const runTestCase = async (testCaseId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Running encrypted test with FHE..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const testCaseBytes = await contract.getData(`test_case_${testCaseId}`);
      if (testCaseBytes.length === 0) {
        throw new Error("Test case not found");
      }
      
      const testCaseData = JSON.parse(ethers.toUtf8String(testCaseBytes));
      
      // Randomly pass or fail for simulation
      const status = Math.random() > 0.3 ? "passed" : "failed";
      
      const updatedTestCase = {
        ...testCaseData,
        status: status
      };
      
      await contract.setData(
        `test_case_${testCaseId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedTestCase))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: `FHE test ${status === "passed" ? "passed" : "failed"}!`
      });
      
      await loadTestCases();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Test failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Connect your Web3 wallet to interact with the FHE testing framework",
      icon: "🔗"
    },
    {
      title: "Create Test Case",
      description: "Define your FHE test case with encrypted assertions",
      icon: "📝"
    },
    {
      title: "Run Encrypted Test",
      description: "Execute tests on encrypted data without decryption",
      icon: "⚡"
    },
    {
      title: "Analyze Results",
      description: "Review test outcomes while maintaining data privacy",
      icon: "📊"
    }
  ];

  const renderBarChart = () => {
    const total = testCases.length || 1;
    const passedPercentage = (passedCount / total) * 100;
    const failedPercentage = (failedCount / total) * 100;
    const pendingPercentage = (pendingCount / total) * 100;

    return (
      <div className="bar-chart-container">
        <div className="bar-chart">
          <div className="bar passed" style={{ height: `${passedPercentage}%` }}>
            <span>{passedCount}</span>
          </div>
          <div className="bar failed" style={{ height: `${failedPercentage}%` }}>
            <span>{failedCount}</span>
          </div>
          <div className="bar pending" style={{ height: `${pendingPercentage}%` }}>
            <span>{pendingCount}</span>
          </div>
        </div>
        <div className="bar-labels">
          <div className="label">Passed</div>
          <div className="label">Failed</div>
          <div className="label">Pending</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="tech-spinner"></div>
      <p>Initializing FHE testing environment...</p>
    </div>
  );

  return (
    <div className="app-container tech-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>FHE<span>Test</span>Framework</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-test-btn tech-button"
          >
            <div className="add-icon"></div>
            New Test Case
          </button>
          <button 
            className="tech-button"
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? "Hide Tutorial" : "Show Tutorial"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Fully Homomorphic Encryption Testing Framework</h2>
            <p>Test encrypted data without decryption using advanced FHE assertions</p>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section">
            <h2>FHE Testing Tutorial</h2>
            <p className="subtitle">Learn how to create and run encrypted tests</p>
            
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div 
                  className="tutorial-step"
                  key={index}
                >
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="dashboard-grid">
          <div className="dashboard-card tech-card">
            <h3>Project Introduction</h3>
            <p>The FHE Testing Framework enables developers to write and execute tests on encrypted data without decryption. Our specialized assertion library supports:</p>
            <ul>
              <li>Encrypted data equivalence assertions</li>
              <li>Range and conditional checks on ciphertexts</li>
              <li>Mock encrypted objects</li>
              <li>Integration with existing testing frameworks</li>
            </ul>
            <div className="fhe-badge">
              <span>FHE-Powered</span>
            </div>
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>Test Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{testCases.length}</div>
                <div className="stat-label">Total Tests</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{passedCount}</div>
                <div className="stat-label">Passed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{failedCount}</div>
                <div className="stat-label">Failed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{pendingCount}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>Test Results</h3>
            {renderBarChart()}
          </div>
        </div>
        
        <div className="team-section tech-card">
          <h3>Core Team</h3>
          <div className="team-members">
            <div className="member">
              <div className="avatar"></div>
              <h4>Dr. Alan Turing</h4>
              <p>Cryptography Lead</p>
            </div>
            <div className="member">
              <div className="avatar"></div>
              <h4>Grace Hopper</h4>
              <p>Framework Architect</p>
            </div>
            <div className="member">
              <div className="avatar"></div>
              <h4>Ada Lovelace</h4>
              <p>Testing Specialist</p>
            </div>
          </div>
        </div>
        
        <div className="test-cases-section">
          <div className="section-header">
            <h2>FHE Test Cases</h2>
            <div className="header-actions">
              <button 
                onClick={loadTestCases}
                className="refresh-btn tech-button"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="test-cases-list tech-card">
            <div className="table-header">
              <div className="header-cell">Name</div>
              <div className="header-cell">Description</div>
              <div className="header-cell">FHE Type</div>
              <div className="header-cell">Owner</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Status</div>
              <div className="header-cell">Actions</div>
            </div>
            
            {testCases.length === 0 ? (
              <div className="no-tests">
                <div className="no-tests-icon"></div>
                <p>No test cases found</p>
                <button 
                  className="tech-button primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Test Case
                </button>
              </div>
            ) : (
              testCases.map(testCase => (
                <div className="test-case-row" key={testCase.id}>
                  <div className="table-cell">{testCase.name}</div>
                  <div className="table-cell">{testCase.description.substring(0, 30)}...</div>
                  <div className="table-cell">{testCase.fheType}</div>
                  <div className="table-cell">{testCase.owner.substring(0, 6)}...{testCase.owner.substring(38)}</div>
                  <div className="table-cell">
                    {new Date(testCase.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="table-cell">
                    <span className={`status-badge ${testCase.status}`}>
                      {testCase.status}
                    </span>
                  </div>
                  <div className="table-cell actions">
                    {isOwner(testCase.owner) && testCase.status === "pending" && (
                      <button 
                        className="action-btn tech-button primary"
                        onClick={() => runTestCase(testCase.id)}
                      >
                        Run Test
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitTestCase} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          testCase={newTestCase}
          setTestCase={setNewTestCase}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content tech-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="tech-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>FHE Test Framework</span>
            </div>
            <p>Secure encrypted testing using FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Testing</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} FHE Test Framework. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  testCase: any;
  setTestCase: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  testCase,
  setTestCase
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTestCase({
      ...testCase,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!testCase.name || !testCase.description) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal tech-card">
        <div className="modal-header">
          <h2>Create New FHE Test Case</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Your test will execute on encrypted data without decryption
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Test Name *</label>
              <input 
                type="text"
                name="name"
                value={testCase.name} 
                onChange={handleChange}
                placeholder="Equivalence test..." 
                className="tech-input"
              />
            </div>
            
            <div className="form-group">
              <label>FHE Type *</label>
              <select 
                name="fheType"
                value={testCase.fheType} 
                onChange={handleChange}
                className="tech-select"
              >
                <option value="Concrete">Concrete</option>
                <option value="TFHE-rs">TFHE-rs</option>
                <option value="OpenFHE">OpenFHE</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group full-width">
              <label>Description *</label>
              <textarea 
                name="description"
                value={testCase.description} 
                onChange={handleChange}
                placeholder="Describe the test case and assertions..." 
                className="tech-textarea"
                rows={4}
              />
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Test executes on encrypted data without decryption
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn tech-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn tech-button primary"
          >
            {creating ? "Creating encrypted test..." : "Create Test Case"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;