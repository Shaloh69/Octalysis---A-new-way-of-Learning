<!-- Slide number: 1 -->
# Computer System Organization and Assembly Language

### Notes:

<!-- Slide number: 2 -->
# What is Computer Programming?
Computer Programming is the process of writing a set of instructions that direct a computer what to do.  These set of instructions are called programs, and the people who write them are called programmers.
Just as human beings communicate with each other through the use of languages such as Filipino, English, or Cebuano, programmers use a variety of special languages, called programming languages, to communicate with the computer.  Some popular programming languages are COBOL(Common Business Oriented Language), Pascal, C, BASIC (Beginner’s All-Purpose Symbolic Instruction Code), and Assembly Language.

### Notes:

<!-- Slide number: 3 -->
# Levels of Programming Languages
1. Machine Language
	Within a computer, microscopic electronic switches that can be either off or on represent all data.  The off switch is designated by a 0, and the on switch is designated by a 1.  Because computers can understand only these on and off switches, the first programmers had to write the program instruction using nothing but combinations of 0s and 1s.  Instructions written in 0s and 1s are called machine code.

### Notes:

<!-- Slide number: 4 -->
# Levels of Programming Languages
	Figure 1.1 shows a program in machine code.

	As you can imagine, programming in machine language or machine code is very tedious and error-prone; it also requires highly trained programmers.

### Notes:

<!-- Slide number: 5 -->
# Machine Code
0100
001101	100000	001101	110001
00101	10001	10000
01110
111001
111001	001	11000	001
11000
0011100
100010	00110
Figure 1.1:  A program in machine code

### Notes:

<!-- Slide number: 6 -->
# Levels of Programming Languages
2. Assembly Languages
	Assembly languages simplify the programmer’s job by allowing the programmer to use mnemonics in place of the 0s and 1s in the program.  Mnemonics are memory aids – in this case, alphabetic abbreviations for instructions.  For example, most assembly languages use the mnemonic ADD to represent an add operation and the mnemonic MUL to represent a multiply operation.  Programs written in assembly language require an assembler, which is also a program, to convert the assembly instructions into machine code – the 0s and 1s the computer can understand.

### Notes:

<!-- Slide number: 7 -->
# Levels of Programming Languages
	Although it is much easier to write programs in assembly language than in machine language, programming in assembly language still is tedious and requires highly trained programmers.

   Figure 1.2 shows a program in written in an assembly language.

### Notes:

<!-- Slide number: 8 -->
# A Brief History of Programming Languages
main proc pay
       mov ax, dseg
mov ax, 0b00h
add ax, dx
mov a1, b1
mul b1, ax
mov b1, 04h
Figure 1.2:  A program in assembly language

### Notes:

<!-- Slide number: 9 -->
# Levels of Programming Languages
3. High-Level Languages
	High-level languages, which allow the programmer to use instructions that more closely resemble the English language, require either an interpreter or a compiler to convert the English-like instructions into the 0s and 1s the computer understands.  Like assemblers, both interpreters and compilers are separate programs.  An interpreter translates the high-level instructions into machine code, line by line, as the program is running; a compiler translates the entire program into machine code before running the program.  Like their predecessors, most high-level languages are procedure-oriented.

### Notes:

<!-- Slide number: 10 -->
# Levels of Programming Languages
3a. Procedure-Oriented High-Level Languages/Structured-Oriented High Level Languages
	In procedure-oriented high-level languages, the emphasis of a program is on how to accomplish a task.  The programmer must instruct the computer every step of the way, from the start of the task to its completion.  The programmer determines and controls the order in which the computer should process the instructions.  COBOL, BASIC, Pascal, and C are popular procedure-oriented languages.

### Notes:

<!-- Slide number: 11 -->
# Levels of Programming Languages
 Figure 1.3 shows a program written in BASIC.
input “Enter Name”; name$
input “Enter Hours”; hours
input “Enter Rate”; rate
gross = hours * rate
fwt = 0.2 * gross
socsec = 0.07 * gross
state = 0.06 * gross
net = gross – fwt – socsec – state
print name$, net
end
Figure 1.3:  A program in BASIC

### Notes:

<!-- Slide number: 12 -->
# Levels of Programming Languages
	Notice how closely the instructions resemble the English language.  Notice also the order of the instructions.  When writing programs in a procedure-oriented language, the programmer must determine not only the proper instructions to give the computer, but the correct sequence of those instructions as well.

### Notes:

<!-- Slide number: 13 -->
# Levels of Programming Languages
3b. Object-Oriented/Event-Driven High-Level Languages
	In object-oriented/event-driven languages, the emphasis of a program is on the objects included in the user interface (such as scroll bars and buttons) and the events (such as scrolling and clicking) that occur when those objects are used.

### Notes:

<!-- Slide number: 14 -->
# Levels of Programming Languages
	Visual Basic, Java and C# are an object-oriented/event-driven programming language.  With Visual Basic  for example, it takes just a few clicks of the mouse to include standard Windows objects such as buttons, list boxes, or icons in your Windows application.  Once the objects are created, the programmer then concentrates on writing the specific instructions telling each object how to respond when clicked, double clicked, scrolled, and so on.

### Notes:

<!-- Slide number: 15 -->
# Levels of Programming Languages
	Figure 1.4 shows the Visual Basic instructions that direct an object to end the application when the user clicks the object.  (In this case the object is an Exit button).

Private Sub cmdExit_Click()
	End
End Sub
Figure 1.4:  A program in Visual Basic

### Notes:

<!-- Slide number: 16 -->
# Advantages of Assembly Language
Shows how program interfaces with the processor, operating system, and BIOS.
Shows how data is represented and stored in memory and on external devices.
Clarifies how processor accesses and executes instructions and how instructions access and process data.
Clarifies how a program accesses external devices.

### Notes:

<!-- Slide number: 17 -->
# Reasons for using Assembly Language
A program written in Assembly Language requires considerably less memory and execution time than one written in a high –level language.
Assembly Language gives a programmer the ability to perform highly technical tasks that would be difficult, if not impossible in a high-level language.
Although most software specialists develop new applications in high-level languages, which are easier to write and maintain, a common practice is to recode in assembly language those sections that are time-critical.
Resident programs (that reside in memory while other program execute) and interrupt service routines (that handle input and output) are almost always develop in Assembly Language.

### Notes:
