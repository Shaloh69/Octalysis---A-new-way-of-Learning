<!-- Slide number: 1 -->
# Chapter 1
Introduction

<!-- Slide number: 2 -->
# Chapter 1 Objectives
Computer organization and architecture.
Units of measure common to computer systems.
Computer as a layered system.
Components von Neumann architecture and the function of basic computer components.
2

<!-- Slide number: 3 -->
1.1 Overview
# Why study computer organization and architecture?
Design better programs, including system software such as compilers, operating systems, and device drivers.
Optimize program behavior.
Evaluate (benchmark) computer system performance.
Understand time, space, and price tradeoffs.
<number>

<!-- Slide number: 4 -->
# 1.1 Overview
Computer organization
physical aspects of computer systems.
E.g., circuit design, control signals, memory types.
How does a computer work?
Computer architecture
Logical aspects of system as seen by the programmer.
E.g., instruction sets, instruction formats, data types, addressing modes.
How do I design a computer?
<number>

<!-- Slide number: 5 -->
# 1.2 Computer Components
Principle of Equivalence of Hardware and Software:

Anything that can be done with software can also be done with hardware, and anything that can be done with hardware can also be done with software.*
* Assuming speed is not a concern.
<number>

<!-- Slide number: 6 -->
1.2 Computer Components
# At the most basic level, a computer is a device consisting of three pieces:

A processor to interpret and execute programs
A memory to store both data and programs
A mechanism for transferring data to and from the outside world.
6

<!-- Slide number: 7 -->
1.3 An Example System
# Consider this advertisement:
MHz??

![](Ad1.jpg)
L1 Cache??
MB??
PCI??
USB??
What does it all mean??
7

<!-- Slide number: 8 -->
1.3 An Example System
# Measures of capacity and speed:

Kilo- (K) = 1 thousand = 103 and 210
Mega- (M) = 1 million = 106 and 220
Giga- (G) = 1 billion = 109 and 230
Tera- (T) = 1 trillion = 1012 and 240
Peta- (P) = 1 quadrillion = 1015 and 250
8

<!-- Slide number: 9 -->
1.3 An Example System
# Hertz = clock cycles per second (frequency)
1MHz = 1,000,000Hz
Processor speeds are measured in MHz or GHz.

Byte = a unit of storage
1KB = 210 = 1024 Bytes
1MB = 220 = 1,048,576 Bytes
Main memory (RAM) is measured in MB
Disk storage is measured in GB for small systems, TB for large systems.
9

<!-- Slide number: 10 -->
# 1.3 An Example System
Measures of time and space:

Milli- (m) = 1 thousandth = 10 -3
Micro- () = 1 millionth = 10 -6
Nano- (n) = 1 billionth = 10 -9
Pico- (p) = 1 trillionth = 10 -12
Femto- (f) = 1 quadrillionth = 10 -15
10

<!-- Slide number: 11 -->
1.3 An Example System
# Millisecond =  1 thousandth of a second
Hard disk drive access times are often 10 to 20 milliseconds.
Nanosecond = 1 billionth of a second
Main memory access times are often 50 to 70 nanoseconds.
Micron (micrometer) = 1 millionth of a meter
Circuits on computer chips are measured in microns.
11

<!-- Slide number: 12 -->
1.3 An Example System
# Cycle time is the reciprocal of clock frequency.
A bus operating at 133MHz has a cycle time of 7.52 nanoseconds:
133,000,000 cycles/second  =  7.52ns/cycle
Now back to the advertisement ...
12

<!-- Slide number: 13 -->
# 1.3 An Example System

![](Ad1.jpg)

The microprocessor is the “brain” of the system.  It executes program instructions.  This one is a Pentium (Intel) running at 4.20GHz.

A system bus moves data within the computer.  The faster the bus the better.  This one runs at 400MHz.
13

<!-- Slide number: 14 -->
# 1.3 An Example System
Large main memory capacity means you can run larger programs with greater speed than computers having small memories.
RAM = random access memory.  Time to access contents is independent of its location.
Cache is a type of temporary memory that can be accessed faster than RAM.
14

<!-- Slide number: 15 -->
# 1.3 An Example System

![](Ad1.jpg)

This system has 256MB of (fast) synchronous dynamic RAM (SDRAM) . . .

… and two levels of cache memory, the level 1 (L1) cache is smaller and (probably) faster than the L2 cache.  Note that these cache sizes are measured in KB.
15

<!-- Slide number: 16 -->
# 1.3 An Example System
Hard disk capacity determines the amount of data and size of programs you can store.

![](Ad1.jpg)

This one can store 80GB.  7200 RPM is the rotational speed of the disk.  Generally, the faster a disk rotates, the faster it can deliver data to RAM.  (There are many other factors involved.)
16

<!-- Slide number: 17 -->
# 1.3 An Example System
ATA stands for advanced technology attachment, which describes how the hard disk interfaces with (or connects to) other system components.

![](Ad1.jpg)

A CD can store about 650MB of data. This drive supports rewritable CDs, CD-RW, that can be written to many times..  48x describes its speed.
17

<!-- Slide number: 18 -->
# 1.3 An Example System
Ports allow movement of data between a system and its external devices.

![](Ad1.jpg)

This system has ten ports.
18

<!-- Slide number: 19 -->
# 1.3 An Example System
Serial ports send data as a series of pulses along one or two data lines.
Parallel ports send data as a single pulse along at least eight data lines.
USB, Universal Serial Bus, is an intelligent serial interface that is self-configuring.  (It supports “plug and play.”)
19

<!-- Slide number: 20 -->
# 1.3 An Example System

![](Ad1.jpg)
System buses can be augmented by dedicated I/O buses.  PCI, peripheral component interface, is one such bus.

This system has three PCI devices: a video card, a sound card, and a data/fax modem.
20

<!-- Slide number: 21 -->
# 1.3 An Example System
The number of times per second that the image on a monitor is repainted is its refresh rate. The dot pitch of a monitor tells us how clear the image is.

![](Ad1.jpg)
This one has a dot pitch of 0.24mm and a refresh rate of 75Hz.

The video card contains memory and programs that support the monitor.
21

<!-- Slide number: 22 -->
1.5 Historical Development
# The evolution of computing machinery has taken place over several centuries. The evolution of computers is usually classified into different generations according to the technology of the era.
<number>

<!-- Slide number: 23 -->
1.5 Historical Development
# Generation Zero: Mechanical Calculating Machines (1642 - 1945)
Calculating Clock - Wilhelm Schickard (1592 - 1635).
Pascaline - Blaise Pascal (1623 - 1662).
Difference Engine - Charles Babbage (1791 - 1871), also designed but never built the Analytical Engine.
Punched card tabulating machines - Herman Hollerith (1860 - 1929).
Hollerith cards were commonly used for computer input well into the 1970s.
<number>

<!-- Slide number: 24 -->
1.5 Historical Development
# The First Generation: Vacuum Tube Computers (1945 - 1953)
Atanasoff Berry Computer (1937 - 1938)  solved systems of linear equations.
John Atanasoff and Clifford Berry of  Iowa State University.

![](TUBE1.jpg)
<number>

<!-- Slide number: 25 -->
1.5 Historical Development
# The First Generation: Vacuum Tube Computers (1945 - 1953)
Electronic Numerical Integrator and Computer (ENIAC)  by John Mauchly and J. Presper Eckertat the University of Pennsylvania, 1946
The IBM 650 first mass-produced computer. (1955). It was phased out in 1969.

<number>

<!-- Slide number: 26 -->
1.5 Historical Development
# The Second Generation: Transistorized Computers (1954 - 1965)

![](TRANS.jpg)
IBM 7094 (scientific) and 1401 (business)
Digital Equipment Corporation (DEC) PDP-1
Univac 1100
Control Data Corporation 1604.
. . . and many others.

<number>

<!-- Slide number: 27 -->
1.5 Historical Development
# The Third Generation: Integrated Circuit Computers (1965 - 1980)
IBM 360
DEC PDP-8 and PDP-11
Cray-1 supercomputer
. . . and many others.
By this time, IBM had gained overwhelming dominance in the industry.
Computer manufacturers of this era were characterized as IBM and the BUNCH (Burroughs, Unisys, NCR, Control Data, and Honeywell).
<number>

<!-- Slide number: 28 -->
1.5 Historical Development
# The Fourth Generation: VLSI Computers (1980 - ????)
Very large scale integrated circuits (VLSI) have more than 10,000 components per chip.
Enabled the creation of   microprocessors.
The first was the 4-bit Intel 4004.
Later versions, such as the 8080, 8086, and 8088 spawned the idea of “personal computing.”

<number>

<!-- Slide number: 29 -->
1.5 Historical Development
# Moore’s Law (1965)
Gordon Moore, Intel founder
“The density of transistors in an integrated circuit will double every year.”
Contemporary version:
“The density of silicon chips doubles every 18 months.”
But this “law” cannot hold forever ...
<number>

<!-- Slide number: 30 -->
1.5 Historical Development
# Rock’s Law
Arthur Rock, Intel financier
“The cost of capital equipment to build semiconductors will double every four years.”
In 1968, a new chip plant cost about $12,000.
At the time, $12,000 would buy a nice home in the suburbs.
An executive earning $12,000 per year was “making a very comfortable living.”
<number>

<!-- Slide number: 31 -->
1.5 Historical Development
# Rock’s Law
In 2005, a chip plants under construction cost over $2.5 billion.

For Moore’s Law to hold, Rock’s Law must fall, or vice versa.  But no one can say which will give out first.
$2.5 billion is more than the gross domestic product of some small countries, including Belize, Bhutan, and the Republic of Sierra Leone.
<number>

<!-- Slide number: 32 -->
1.6 The Computer Level Hierarchy
# Writing complex programs requires a “divide and conquer” approach, where each program module solves a smaller problem.

Complex computer systems employ a similar technique through a series of virtual machine layers.
<number>

<!-- Slide number: 33 -->
1.6 The Computer Level Hierarchy
# Each virtual machine layer is an abstraction of the level below it.
The machines at each level execute their own particular instructions, calling upon machines at lower levels to perform tasks as required.
Computer circuits ultimately carry out the work.

![](Layers.jpg)
<number>

<!-- Slide number: 34 -->
1.6 The Computer Level Hierarchy
# Level 6: The User Level
Program execution and user interface level.
The level with which we are most familiar.
Level 5: High-Level Language Level
The level with which we interact when we write programs in languages such as C, Pascal, Lisp, and Java.
<number>

<!-- Slide number: 35 -->
1.6 The Computer Level Hierarchy
# Level 4: Assembly Language Level
Acts upon assembly language produced from Level 5, as well as instructions programmed directly at this level.
Level 3: System Software Level
Controls executing processes on the system.
Protects system resources.
Assembly language instructions often pass through Level 3 without modification.
<number>

<!-- Slide number: 36 -->
1.6 The Computer Level Hierarchy
# Level 2: Machine Level
Also known as the Instruction Set Architecture (ISA) Level.
Consists of instructions that are particular to the architecture of the machine.
Programs written in machine language need no compilers, interpreters, or assemblers.

<number>

<!-- Slide number: 37 -->
1.6 The Computer Level Hierarchy
# Level 1: Control Level
A control unit decodes and executes instructions and moves data through the system.
Control units can be microprogrammed or hardwired.
A microprogram is a program written in a low-level language that is implemented by the hardware.
Hardwired control units consist of hardware that directly executes machine instructions.
<number>

<!-- Slide number: 38 -->
1.6 The Computer Level Hierarchy
# Level 0: Digital Logic Level
This level is where we find digital circuits (the chips).
Digital circuits consist of gates and wires.
These components implement the mathematical logic of all other levels.
<number>

<!-- Slide number: 39 -->
1.7 The von Neumann Model
# On the ENIAC, all programming was done at the digital logic level. Programming the computer involved moving plugs and wires.

A different hardware configuration was needed to solve every unique problem type.
Configuring the ENIAC to solve a “simple” problem required many days labor  by skilled technicians.
<number>

<!-- Slide number: 40 -->
1.7 The von Neumann Model
# The invention of stored program computers has been ascribed to a mathematician, John von Neumann, who was a contemporary of Mauchley and Eckert.
Stored-program computers have become known as von Neumann Architecture systems.
<number>

<!-- Slide number: 41 -->
# 1.7 The von Neumann Model
Today’s stored-program computers have the following characteristics:
Three hardware systems:
A central processing unit (CPU)
A main memory system
An I/O system
The capacity to carry out sequential instruction processing.
A single data path between the CPU and main memory.
This single path is known as the von Neumann bottleneck.
<number>

<!-- Slide number: 42 -->
# 1.7 The von Neumann Model

![](ALU.jpg)
This is a general depiction of a von Neumann system:

These computers employ a fetch-decode-execute cycle to run programs as follows . . .
<number>

<!-- Slide number: 43 -->
# 1.7 The von Neumann Model
The control unit fetches the next instruction from memory using the program counter to determine where the instruction is located.

![](ALU1.jpg)
<number>

<!-- Slide number: 44 -->
# 1.7 The von Neumann Model
The instruction is decoded into a language that the ALU can understand.

![](ALU2.jpg)
<number>

<!-- Slide number: 45 -->
# 1.7 The von Neumann Model
Any data operands required to execute the instruction are fetched from memory and placed into registers within the CPU.

![](ALU3.jpg)
<number>

<!-- Slide number: 46 -->
# 1.7 The von Neumann Model
The ALU executes the instruction and places results in registers or memory.

![](ALU4.jpg)
<number>

<!-- Slide number: 47 -->
1.8 Non-von Neumann Models
# Conventional stored-program computers have undergone many incremental improvements over the years.
These improvements include adding specialized buses, floating-point units, and cache memories, to name only a few.
But enormous improvements in computational power require departure from the classic von Neumann architecture.
Adding processors is one approach.

<number>

<!-- Slide number: 48 -->
1.8 Non-von Neumann Models
# In the late 1960s, high-performance computer systems were equipped with dual processors to increase computational throughput.
In the 1970s supercomputer systems were introduced with 32 processors.
Supercomputers with 1,000 processors were built in the 1980s.
In 1999, IBM announced its Blue Gene system containing over 1 million processors.
<number>

<!-- Slide number: 49 -->
1.8 Non-von Neumann Models
# Parallel processing is only one method of providing increased computational power.
DNA computers, quantum computers, and dataflow systems. At this point, it is unclear whether any of these systems will provide the basis for the next generation of computers.
<number>

<!-- Slide number: 50 -->
1.8 Non-von Neumann Models
# Leonard Adleman is often called the inventor of DNA computers. His article in a 1994 issue of the journal Science outlined how to use DNA to solve a well-known mathematical problem, called the "traveling salesman" problem. The goal of the problem is to find the shortest route between a number of cities, going through each city only once. As you add more cities to the problem, the problem becomes more difficult. Adleman chose to find the shortest route between seven cities. DNA computing is still in its infancy.
<number>

<!-- Slide number: 51 -->
Conclusion
# This chapter has given you an overview of the subject of computer architecture.
<number>

<!-- Slide number: 52 -->
# End of Chapter 1
<number>
