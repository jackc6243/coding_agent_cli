#!/usr/bin/env python3
"""
Simple command-line calculator.

Usage examples:
  python calculator.py add 2 3      # 5.0
  python calculator.py sub 10 4     # 6.0
  python calculator.py mul 3 3      # 9.0
  python calculator.py div 10 2     # 5.0

You can also make it executable and run: ./calculator.py add 2 3
"""
import argparse
import operator
import sys


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Simple calculator")
    subparsers = parser.add_subparsers(dest="operation", required=True)

    ops = [
        ("add", operator.add, "Add two numbers (a + b)"),
        ("sub", operator.sub, "Subtract b from a (a - b)"),
        ("mul", operator.mul, "Multiply two numbers (a * b)"),
        ("div", operator.truediv, "Divide a by b (a / b)"),
    ]

    for name, func, help_text in ops:
        sp = subparsers.add_parser(name, help=help_text)
        sp.add_argument("a", type=float, help="First number (a)")
        sp.add_argument("b", type=float, help="Second number (b)")
        sp.set_defaults(func=func)

    return parser


def main(argv=None) -> int:
    parser = make_parser()
    args = parser.parse_args(argv)

    try:
        result = args.func(args.a, args.b)
    except ZeroDivisionError:
        print("Error: Division by zero is not allowed.", file=sys.stderr)
        return 1

    # Print as int if it's effectively an integer, else as float
    if isinstance(result, float) and result.is_integer():
        print(int(result))
    else:
        print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
