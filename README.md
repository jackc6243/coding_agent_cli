# Simple Calculator App

A Python calculator application with both command-line and GUI interfaces.

## Features

### Common Features
- Basic arithmetic operations: addition (+), subtraction (-), multiplication (*), division (/)
- Power operations (**)
- Square root
- Modulo operations (%)
- Error handling for invalid operations

### Command-Line Calculator
- Expression evaluation (e.g., "2 + 3 * 4")
- Calculation history
- Support for functions like sqrt()
- Interactive command interface

### GUI Calculator
- Modern calculator interface with buttons
- Standard calculator layout
- Additional functions: square (x²), power (x^y)
- Visual feedback and error messages

## Files

- `calculator.py` - Command-line calculator
- `calculator_gui.py` - GUI calculator using tkinter
- `run_calculator.py` - Launcher to choose between versions
- `README.md` - This file

## Usage

### Method 1: Use the Launcher
```bash
python run_calculator.py
```
Then choose between command-line (1) or GUI (2) versions.

### Method 2: Run Directly

**Command-line calculator:**
```bash
python calculator.py
```

**GUI calculator:**
```bash
python calculator_gui.py
```

## Examples

### Command-line Examples
```
Enter calculation: 2 + 3 * 4
Result: 14

Enter calculation: sqrt(16) + 2**3
Result: 12.0

Enter calculation: 15 % 4
Result: 3
```

### GUI Calculator
- Click number buttons to input numbers
- Click operation buttons (+, -, ×, ÷) for basic operations
- Use special buttons:
  - `C` - Clear current number
  - `Clear` - Clear everything
  - `±` - Toggle sign
  - `√` - Square root
  - `x²` - Square current number
  - `x^y` - Power operation
  - `=` - Calculate result

## Requirements

- Python 3.6 or higher
- tkinter (usually included with Python) for GUI version

## Commands (Command-line version)

- `history` - Show calculation history
- `clear` - Clear history
- `quit` or `exit` - Exit calculator

## Error Handling

The calculator handles common errors like:
- Division by zero
- Square root of negative numbers
- Invalid expressions
- Modulo with zero

## Note

The GUI calculator uses tkinter, which is typically included with Python installations. If you encounter issues with the GUI version, ensure tkinter is properly installed on your system.