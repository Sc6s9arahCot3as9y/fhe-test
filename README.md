# FHE Test Framework

A core utility framework designed for testing Fully Homomorphic Encryption (FHE) programs. It provides an assertion library that works directly on encrypted data, without requiring decryption. This enables developers to validate encrypted computations in a secure and transparent way.

## Project Background

Traditional testing frameworks are not equipped to handle encrypted data. Common limitations include:

• Inability to compare encrypted values directly  
• Lack of tools for testing ranges or conditions on ciphertexts  
• Difficulty in mocking encrypted objects for test scenarios  
• Limited integration with popular testing environments  

The FHE Test Framework solves these challenges by providing a dedicated API for encrypted data testing:

• Encrypted values can be asserted for equivalence  
• Range and condition-based assertions are supported  
• Mock encrypted objects can be created for simulation  
• Easy integration with existing testing frameworks such as pytest  

## Features

### Core Functionality

• Encrypted Equality Assertions: Check if two ciphertexts represent the same plaintext value  
• Range Assertions: Verify whether an encrypted value lies within a given interval  
• Conditional Assertions: Assert properties about encrypted computations without decryption  
• Mock Objects: Generate fake encrypted data for controlled testing scenarios  
• Test Framework Integration: Compatible with pytest and other existing testing tools  

### Privacy & Security

• No Decryption Required: Assertions operate entirely on encrypted data  
• Homomorphic Compatibility: Designed to work with FHE libraries such as Concrete and TFHE-rs  
• Secure Mocking: Safely simulate encrypted data without exposing plaintexts  
• Minimal Attack Surface: Ensures sensitive data remains protected throughout the testing process  

## Architecture

### Python/Rust API

• High-level testing API for Python developers  
• Low-level Rust bindings for performance-sensitive environments  
• Unified interface for encrypted assertions and mocks  

### Integration Layer

• pytest plugin for seamless test suite integration  
• Extensible design for adding support to other testing frameworks  
• Compatible with multiple FHE backends (Concrete, TFHE-rs)  

## Technology Stack

• Python (for high-level API and pytest integration)  
• Rust (for performance-critical components)  
• Concrete, TFHE-rs (FHE backends)  
• pytest (primary testing framework support)  

## Installation

### Prerequisites

• Python 3.9+  
• Rust (latest stable release)  
• pip or poetry for dependency management  

### Setup

```bash
# Clone repository
git clone https://github.com/example/fhe-test.git
cd fhe-test

# Install dependencies
pip install -r requirements.txt

# Build Rust components
cargo build --release

# Install pytest plugin
pip install -e .
```

## Usage

• Write tests using encrypted data assertions  
• Run tests with pytest integration  
• Simulate scenarios with mocked encrypted values  
• Verify FHE computations securely without exposing plaintexts  

### Example

```python
from fhe_test import assert_encrypted_equal, mock_ciphertext

def test_encrypted_computation():
    x = mock_ciphertext(5)
    y = mock_ciphertext(5)
    assert_encrypted_equal(x, y)
```

## Security Features

• No plaintext leakage during testing  
• Assertions operate entirely in the encrypted domain  
• Secure mocking to prevent misuse  
• Integration with trusted FHE libraries  

## Future Enhancements

• Expand support for additional FHE libraries  
• Add richer conditional assertions (e.g., modular checks, boolean logic)  
• Provide benchmarking tools for encrypted computation testing  
• Enable CI/CD integration for automated encrypted testing pipelines  

Built with 🔒 to advance secure testing in the FHE ecosystem  
