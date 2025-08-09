#!/usr/bin/env python3

import argparse

def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def multiply(a, b):
    return a * b

def divide(a, b):
    if b == 0:
        return "Error: Division by zero"
    return a / b

def main():
    parser = argparse.ArgumentParser(description='Simple command line calculator')
    parser.add_argument('operation', choices=['add', 'subtract', 'multiply', 'divide'],
                        help='Operation to perform')
    parser.add_argument('a', type=float, help='First number')
    parser.add_argument('b', type=float, help='Second number')
    
    args = parser.parse_args()
    
    if args.operation == 'add':
        result = add(args.a, args.b)
    elif args.operation == 'subtract':
        result = subtract(args.a, args.b)
    elif args.operation == 'multiply':
        result = multiply(args.a, args.b)
    elif args.operation == 'divide':
        result = divide(args.a, args.b)
    
    print(f"Result: {result}")

if __name__ == '__main__':
    main()
