College Event Management System

A web-based College Event Management System designed to simplify the process of creating, managing, and registering for college events. The system allows administrators to manage events and students to view event details and register for available events.

Features
Student
Student registration and login
Student profile management
View upcoming events
View event details
Register for events
View registered events
Event Management
Create new events
Edit event details
Delete events
Set event date, time, venue, and participant limit
Set registration deadline
Display available seats
Display event details
Admin
Admin dashboard
Manage events
Manage students
View event participants
View event statistics
Other Features
Event registration confirmation
Participant management
Attendance management
Notifications
Event and participant reports
Technologies Used
Frontend: HTML, CSS, JavaScript
Backend: Python, Django
Database: SQLite
Version Control: Git & GitHub
Project Structure
College-Event-Management-System/
│
├── manage.py
│
├── project/
│   ├── settings.py
│   ├── urls.py
│   └── ...
│
├── authentication/
│   ├── models.py
│   ├── views.py
│   ├── forms.py
│   └── ...
│
├── events/
│   ├── migrations/
│   ├── models.py
│   ├── forms.py
│   ├── views.py
│   ├── urls.py
│   └── templates/
│       └── events/
│
├── templates/
│
└── static/
Main Modules
User Authentication & Profile
Event Management
Student Event Registration
Participant Management
Admin Dashboard
Notifications & Reports
Installation
1. Clone the Repository
git clone <your-github-repository-url>
cd College-Event-Management-System
2. Create a Virtual Environment
python -m venv venv
3. Activate the Virtual Environment

Windows:

venv\Scripts\activate
4. Install Dependencies
pip install django
5. Run Migrations
python manage.py makemigrations
python manage.py migrate
6. Create Admin Account
python manage.py createsuperuser

Follow the instructions in the terminal.

7. Start the Server
python manage.py runserver

Open:

http://127.0.0.1:8000/
Event Management Module

The Event Management module allows authorized users to:

Create events
View all events
Edit events
Delete events
View complete event information
Set maximum participant capacity
Set registration deadlines
Display available seats
Future Enhancements
Email notifications
QR-code based event attendance
Online event certificates
Event calendar
Event search and filtering
Analytics dashboard
Export participant lists as PDF/Excel
