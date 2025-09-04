import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart } from 'recharts';
import './AnalyticsComponent.css';

const AnalyticsComponent = () => {
  const [analyticsData, setAnalyticsData] = useState({
    applicationsAnalytics: {
      statusDistribution: [],
      monthlyTrends: [],
      categoryDistribution: [],
      dayOfWeekDistribution: [],
      processingTimeAnalysis: [],
      applicantDemographics: [],
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0
      }
    },
    studentsAnalytics: {
      monthlyRegistrations: [],
      examResults: [],
      ageDistribution: [],
      groupParticipation: [],
      instructorStudents: [],
      categoryPerformance: [],
      completionRateByMonth: [],
      summary: {
        total: 0,
        withResults: 0,
        averageScore: 0
      }
    },
      instructorsAnalytics: {
    summary: {
      total: 0,
      avgExperience: 0,
      withCars: 0,
      withoutCars: 0
    },
    experienceDistribution: [],
    categoryDistribution: [],
    workloadAnalysis: [],
    carStatus: [],
    ageDistribution: []
  },
  teachersAnalytics: {
    summary: {
      total: 0,
      totalGroups: 0,
      avgStudentsPerGroup: 0
    },
    workloadAnalysis: [],
    ageDistribution: [],
    groupsPerformance: []
  },
  lessonsAnalytics: {
    summary: {
      total: 0,
      completed: 0,
      scheduled: 0,
      cancelled: 0
    },
    monthlyTrends: [],
    typeDistribution: [],
    statusDistribution: [],
    topicDistribution: [],
    dayOfWeekDistribution: [],
    groupLessonsAnalysis: [],
    individualLessonsAnalysis: []
  },
  examsAnalytics: {
    summary: {
      total: 0,
      theoryExams: 0,
      practiceExams: 0,
      avgDurationHours: 0
    },
    monthlyTrends: [],
    typeDistribution: [],
    dayOfWeekDistribution: [],
    locationDistribution: [],
    theoryExamsAnalysis: [],
    practiceExamsAnalysis: [],
    utilizationByDate: []
  },
  classroomsAnalytics: {
  summary: {
    total: 0,
    available: 0,
    unavailable: 0
  }
},
carsAnalytics: {
  summary: {
    total: 0,
    assigned: 0,
    unassigned: 0,
    avgYear: 0
  },
  conditionDistribution: [],
  yearDistribution: [],
  categoryDistribution: [],
  instructorAssignment: []
}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('applications');
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7300'];

  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole') || 'admin';
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'user-role': userRole
    };
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('http://localhost:5000/api/analytics/dashboard', {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics data: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Error loading analytics data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        <div className="error-message">
          <h3>Error loading analytics</h3>
          <p>{error}</p>
          <button onClick={fetchAnalyticsData} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  const renderApplicationsAnalytics = () => (
    <div className="analytics-section">
      <h3>Applications Analytics</h3>
        <div className="kpi-grid">
            <div className="kpi-card">
                <h4>Total Applications</h4>
                <div className="kpi-value">{analyticsData.applicationsAnalytics.summary.total}</div>
            </div>
            <div className="kpi-card">
                <h4>Pending</h4>
                <div className="kpi-value pending">{analyticsData.applicationsAnalytics.summary.pending}</div>
            </div>
            <div className="kpi-card">
                <h4>Approved</h4>
                <div className="kpi-value approved">{analyticsData.applicationsAnalytics.summary.approved}</div>
            </div>
             <div className="kpi-card">
                <h4>Rejected</h4>
                <div className="kpi-value rejected">{analyticsData.applicationsAnalytics.summary.rejected}</div>
            </div>
        </div>
      <div className="charts-grid">
        <div className="chart-card">
          <h4>Application Status Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.applicationsAnalytics.statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {analyticsData.applicationsAnalytics.statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>Monthly Applications Trend</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.applicationsAnalytics.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="applications" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>Study Categories Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.applicationsAnalytics.categoryDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="charts-grid">
        <div className="chart-card">
          <h4>Applications by Day of Week</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.applicationsAnalytics.dayOfWeekDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="applications" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>Processing Time Analysis</h4>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={analyticsData.applicationsAnalytics.processingTimeAnalysis}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeRange" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#FFBB28" name="Applications Count" />
              <Line yAxisId="right" type="monotone" dataKey="avgDays" stroke="#ff7300" strokeWidth={2} name="Avg Days" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>Applicant Demographics</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.applicationsAnalytics.applicantDemographics}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ ageGroup, percent }) => `${ageGroup} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="applications"
              >
                {analyticsData.applicationsAnalytics.applicantDemographics.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="table-card">
        <h4>Application Status Details</h4>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {analyticsData.applicationsAnalytics.statusDistribution.map((stat, index) => (
              <tr key={index}>
                <td>{stat.status}</td>
                <td>{stat.count}</td>
                <td>{analyticsData.applicationsAnalytics.summary.total > 0 
                  ? ((stat.count / analyticsData.applicationsAnalytics.summary.total) * 100).toFixed(1)
                  : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStudentsAnalytics = () => (
    <div className="analytics-section">
      <h3>Students Analytics</h3>
      <div className="kpi-grid">
        <div className="kpi-card">
          <h4>Total Students</h4>
          <div className="kpi-value">{analyticsData.studentsAnalytics.summary.total}</div>
        </div>
        <div className="kpi-card">
          <h4>With Exam Results</h4>
          <div className="kpi-value">{analyticsData.studentsAnalytics.summary.withResults}</div>
        </div>
        <div className="kpi-card">
          <h4>Average Score</h4>
          <div className="kpi-value">{analyticsData.studentsAnalytics.summary.averageScore}%</div>
        </div>
        <div className="kpi-card">
          <h4>Completion Rate</h4>
          <div className="kpi-value">
            {analyticsData.studentsAnalytics.summary.total > 0 
              ? ((analyticsData.studentsAnalytics.summary.withResults / analyticsData.studentsAnalytics.summary.total) * 100).toFixed(1)
              : 0}%
          </div>
        </div>
      </div>
      <div className="charts-grid">
        <div className="chart-card">
          <h4>Monthly Student Registrations</h4>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData.studentsAnalytics.monthlyRegistrations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="students" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>Exam Results Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.studentsAnalytics.examResults}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>Students Age Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.studentsAnalytics.ageDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {analyticsData.studentsAnalytics.ageDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="charts-grid">
        <div className="chart-card">
          <h4>Group Participation</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.studentsAnalytics.groupParticipation}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="groupName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="enrolledStudents" fill="#0088FE" name="Enrolled" />
              <Bar dataKey="currentStudents" fill="#00C49F" name="Capacity" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>Performance by Study Category</h4>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={analyticsData.studentsAnalytics.categoryPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="totalStudents" fill="#8884d8" name="Total Students" />
              <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke="#00C49F" strokeWidth={2} name="Avg Score" />
              <Line yAxisId="right" type="monotone" dataKey="passRate" stroke="#ff7300" strokeWidth={2} name="Pass Rate %" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>Completion Rate by Month</h4>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={analyticsData.studentsAnalytics.completionRateByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="totalStudents" fill="#8884d8" name="Total Students" />
              <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="#ff7300" strokeWidth={2} name="Completion Rate %" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="table-card">
        <h4>Performance by Study Category Details</h4>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Total Students</th>
              <th>With Results</th>
              <th>Avg Score</th>
              <th>Pass Rate</th>
            </tr>
          </thead>
          <tbody>
            {analyticsData.studentsAnalytics.categoryPerformance.map((stat, index) => (
              <tr key={index}>
                <td>{stat.category}</td>
                <td>{stat.totalStudents}</td>
                <td>{stat.studentsWithResults}</td>
                <td>{stat.avgScore}%</td>
                <td>{stat.passRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-card">
        <h4>Group Participation Details</h4>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Group Name</th>
              <th>Teacher</th>
              <th>Enrolled</th>
            </tr>
          </thead>
          <tbody>
            {analyticsData.studentsAnalytics.groupParticipation.map((group, index) => (
              <tr key={index}>
                <td>{group.groupName}</td>
                <td>{group.teacherName}</td>
                <td>{group.enrolledStudents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-card">
        <h4>Individual Lessons by Instructor</h4>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Instructor</th>
              <th>Category</th>
              <th>Students Count</th>
            </tr>
          </thead>
          <tbody>
            {analyticsData.studentsAnalytics.instructorStudents.map((stat, index) => (
              <tr key={index}>
                <td>{stat.instructorName}</td>
                <td>{stat.drivingCategory}</td>
                <td>{stat.studentsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInstructorsAnalytics = () => (
  <div className="analytics-section">
    <h3>Instructors Analytics</h3>
    <div className="kpi-grid">
      <div className="kpi-card">
        <h4>Total Instructors</h4>
        <div className="kpi-value">{analyticsData.instructorsAnalytics.summary.total}</div>
      </div>
      <div className="kpi-card">
        <h4>Average Experience</h4>
        <div className="kpi-value">{analyticsData.instructorsAnalytics.summary.avgExperience} years</div>
      </div>
      <div className="kpi-card">
        <h4>With Cars</h4>
        <div className="kpi-value approved">{analyticsData.instructorsAnalytics.summary.withCars}</div>
      </div>
      <div className="kpi-card">
        <h4>Without Cars</h4>
        <div className="kpi-value rejected">{analyticsData.instructorsAnalytics.summary.withoutCars}</div>
      </div>
    </div>
    
    <div className="charts-grid">
      <div className="chart-card">
        <h4>Experience Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analyticsData.instructorsAnalytics.experienceDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ experienceRange, percent }) => `${experienceRange} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {analyticsData.instructorsAnalytics.experienceDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Instructors by Driving Category</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={analyticsData.instructorsAnalytics.categoryDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Count" />
            <Line yAxisId="right" type="monotone" dataKey="avgExperience" stroke="#ff7300" strokeWidth={2} name="Avg Experience" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Car Status Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analyticsData.instructorsAnalytics.carStatus}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {analyticsData.instructorsAnalytics.carStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Age Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.instructorsAnalytics.ageDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ageGroup" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#00C49F" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="table-card">
      <h4>Instructor Workload Analysis</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Instructor Name</th>
            <th>Category</th>
            <th>Experience</th>
            <th>Students</th>
            <th>Lessons</th>
            <th>Exams</th>
          </tr>
        </thead>
        <tbody>
          {analyticsData.instructorsAnalytics.workloadAnalysis.map((instructor, index) => (
            <tr key={index}>
              <td>{instructor.instructorName}</td>
              <td>{instructor.drivingCategory}</td>
              <td>{instructor.experienceYears} years</td>
              <td>{instructor.totalStudents}</td>
              <td>{instructor.totalLessons}</td>
              <td>{instructor.totalExams}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Функція для рендерингу аналітики вчителів:
const renderTeachersAnalytics = () => (
  <div className="analytics-section">
    <h3>Teachers/Groups Analytics</h3>
    <div className="kpi-grid">
      <div className="kpi-card">
        <h4>Total Teachers</h4>
        <div className="kpi-value">{analyticsData.teachersAnalytics.summary.total}</div>
      </div>
      <div className="kpi-card">
        <h4>Total Groups</h4>
        <div className="kpi-value">{analyticsData.teachersAnalytics.summary.totalGroups}</div>
      </div>
      <div className="kpi-card">
        <h4>Avg Students/Group</h4>
        <div className="kpi-value">{analyticsData.teachersAnalytics.summary.avgStudentsPerGroup}</div>
      </div>
      <div className="kpi-card">
        <h4>Groups/Teacher</h4>
        <div className="kpi-value">
          {analyticsData.teachersAnalytics.summary.total > 0 
            ? (analyticsData.teachersAnalytics.summary.totalGroups / analyticsData.teachersAnalytics.summary.total).toFixed(1)
            : 0}
        </div>
      </div>
    </div>
    
    <div className="charts-grid">
      <div className="chart-card">
        <h4>Teacher Age Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analyticsData.teachersAnalytics.ageDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ ageGroup, percent }) => `${ageGroup} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {analyticsData.teachersAnalytics.ageDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Groups Performance by Teacher</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={analyticsData.teachersAnalytics.groupsPerformance}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="groupName" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="enrolledStudents" fill="#8884d8" name="Enrolled Students" />
            <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke="#00C49F" strokeWidth={2} name="Avg Score" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="table-card">
      <h4>Teacher Workload Analysis</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Teacher Name</th>
            <th>Groups</th>
            <th>Total Students</th>
            <th>Lessons</th>
            <th>Exams</th>
          </tr>
        </thead>
        <tbody>
          {analyticsData.teachersAnalytics.workloadAnalysis.map((teacher, index) => (
            <tr key={index}>
              <td>{teacher.teacherName}</td>
              <td>{teacher.totalGroups}</td>
              <td>{teacher.totalStudents}</td>
              <td>{teacher.totalLessons}</td>
              <td>{teacher.totalExams}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="table-card">
      <h4>Groups Performance Details</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Group Name</th>
            <th>Teacher</th>
            <th>Enrolled</th>
            <th>With Results</th>
            <th>Avg Score</th>
          </tr>
        </thead>
        <tbody>
          {analyticsData.teachersAnalytics.groupsPerformance.map((group, index) => (
            <tr key={index}>
              <td>{group.groupName}</td>
              <td>{group.teacherName}</td>

              <td>{group.enrolledStudents}</td>
              <td>{group.studentsWithResults}</td>
              <td>{group.avgScore}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const renderLessonsAnalytics = () => (
  <div className="analytics-section">
    <h3>Lessons Analytics</h3>
    <div className="kpi-grid">
      <div className="kpi-card">
        <h4>Total Lessons</h4>
        <div className="kpi-value">{analyticsData.lessonsAnalytics.summary.total}</div>
      </div>
      <div className="kpi-card">
        <h4>Completed</h4>
        <div className="kpi-value approved">{analyticsData.lessonsAnalytics.summary.completed}</div>
      </div>
      <div className="kpi-card">
        <h4>Scheduled</h4>
        <div className="kpi-value pending">{analyticsData.lessonsAnalytics.summary.scheduled}</div>
      </div>
      <div className="kpi-card">
        <h4>Cancelled</h4>
        <div className="kpi-value rejected">{analyticsData.lessonsAnalytics.summary.cancelled}</div>
      </div>
    </div>

    <div className="charts-grid">
      <div className="chart-card">
        <h4>Lesson Status Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analyticsData.lessonsAnalytics.statusDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {analyticsData.lessonsAnalytics.statusDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Monthly Lessons Trend</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analyticsData.lessonsAnalytics.monthlyTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="lessons" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Lesson Type Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={analyticsData.lessonsAnalytics.typeDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Count" />
            <Line yAxisId="right" type="monotone" dataKey="avgDurationHours" stroke="#ff7300" strokeWidth={2} name="Avg Duration (h)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Lessons by Day of Week</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.lessonsAnalytics.dayOfWeekDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="lessons" fill="#00C49F" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Top Lesson Topics</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.lessonsAnalytics.topicDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="topic" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#FFBB28" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="table-card">
      <h4>Group Lessons Analysis</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Group Name</th>
            <th>Teacher</th>
            <th>Total Lessons</th>
            <th>Completed</th>
            <th>Classroom</th>
          </tr>
        </thead>
        <tbody>
          {analyticsData.lessonsAnalytics.groupLessonsAnalysis.map((group, index) => (
            <tr key={index}>
              <td>{group.groupName}</td>
              <td>{group.teacherName}</td>
              <td>{group.totalLessons}</td>
              <td>{group.completedLessons}</td>
              <td>{group.classroomName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="table-card">
      <h4>Individual Lessons Analysis</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Instructor</th>
            <th>Category</th>
            <th>Total Lessons</th>
            <th>Completed</th>
            <th>Students</th>
          </tr>
        </thead>
        <tbody>
          {analyticsData.lessonsAnalytics.individualLessonsAnalysis.map((instructor, index) => (
            <tr key={index}>
              <td>{instructor.instructorName}</td>
              <td>{instructor.drivingCategory}</td>
              <td>{instructor.totalLessons}</td>
              <td>{instructor.completedLessons}</td>
              <td>{instructor.uniqueStudents}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const renderExamsAnalytics = () => (
  <div className="analytics-section">
    <h3>Exams Analytics</h3>
    <div className="kpi-grid">
      <div className="kpi-card">
        <h4>Total Exams</h4>
        <div className="kpi-value">{analyticsData.examsAnalytics.summary.total}</div>
      </div>
      <div className="kpi-card">
        <h4>Theory Exams</h4>
        <div className="kpi-value">{analyticsData.examsAnalytics.summary.theoryExams}</div>
      </div>
      <div className="kpi-card">
        <h4>Practice Exams</h4>
        <div className="kpi-value">{analyticsData.examsAnalytics.summary.practiceExams}</div>
      </div>
      <div className="kpi-card">
        <h4>Avg Duration</h4>
        <div className="kpi-value">{analyticsData.examsAnalytics.summary.avgDurationHours}h</div>
      </div>
    </div>

    <div className="charts-grid">
      <div className="chart-card">
        <h4>Exam Type Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analyticsData.examsAnalytics.typeDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {analyticsData.examsAnalytics.typeDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Monthly Exams Trend</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analyticsData.examsAnalytics.monthlyTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="exams" stroke="#FF8042" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Exams by Day of Week</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.examsAnalytics.dayOfWeekDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="exams" fill="#82CA9D" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Exam Locations Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.examsAnalytics.locationDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="location" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#FFC658" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Daily Exam Utilization (Last 30 Days)</h4>
  <ResponsiveContainer width="100%" height={300}>
    <ComposedChart data={analyticsData.examsAnalytics.utilizationByDate}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis 
        dataKey="examDate" 
        tickFormatter={(date) => {
          return new Date(date).toLocaleDateString('uk-UA');
        }}
      />
      <YAxis />
      <Tooltip 
        labelFormatter={(date) => new Date(date).toLocaleDateString('uk-UA')}
      />
      <Legend />
      <Bar dataKey="theoryCount" stackId="a" fill="#8884d8" name="Theory" />
      <Bar dataKey="practiceCount" stackId="a" fill="#82ca9d" name="Practice" />
      <Line type="monotone" dataKey="totalExams" stroke="#ff7300" strokeWidth={2} name="Total" />
    </ComposedChart>
  </ResponsiveContainer>
      </div>
    </div>

    <div className="table-card">
      <h4>Theory Exams Analysis</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Theory Exams</th>
            <th>Classroom</th>
            <th>Capacity</th>
          </tr>
        </thead>
        <tbody>
          {analyticsData.examsAnalytics.theoryExamsAnalysis.map((teacher, index) => (
            <tr key={index}>
              <td>{teacher.teacherName}</td>
              <td>{teacher.totalTheoryExams}</td>
              <td>{teacher.classroomName}</td>
              <td>{teacher.classroomCapacity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="table-card">
      <h4>Practice Exams Analysis</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Instructor</th>
            <th>Category</th>
            <th>Practice Exams</th>
            <th>Car</th>
            <th>Car Info</th>
          </tr>
        </thead>
        <tbody>
          {analyticsData.examsAnalytics.practiceExamsAnalysis.map((instructor, index) => (
            <tr key={index}>
              <td>{instructor.instructorName}</td>
              <td>{instructor.drivingCategory}</td>
              <td>{instructor.totalPracticeExams}</td>
              <td>{instructor.carLicensePlate}</td>
              <td>{instructor.carInfo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const renderClassroomsAnalytics = () => (
  <div className="analytics-section">
    <h3>Classrooms Analytics</h3>
    <div className="kpi-grid">
      <div className="kpi-card">
        <h4>Total Classrooms</h4>
        <div className="kpi-value">{analyticsData.classroomsAnalytics.summary.total}</div>
      </div>
      <div className="kpi-card">
        <h4>Available</h4>
        <div className="kpi-value approved">{analyticsData.classroomsAnalytics.summary.available}</div>
      </div>
      <div className="kpi-card">
        <h4>Unavailable</h4>
        <div className="kpi-value rejected">{analyticsData.classroomsAnalytics.summary.unavailable}</div>
      </div>
      <div className="kpi-card">
        <h4>Availability Rate</h4>
        <div className="kpi-value">
          {analyticsData.classroomsAnalytics.summary.total > 0 
            ? ((analyticsData.classroomsAnalytics.summary.available / analyticsData.classroomsAnalytics.summary.total) * 100).toFixed(1)
            : 0}%
        </div>
      </div>
    </div>
    
    <div className="charts-grid">
      <div className="chart-card">
        <h4>Classroom Status Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={[
                { name: 'Available', value: analyticsData.classroomsAnalytics.summary.available },
                { name: 'Unavailable', value: analyticsData.classroomsAnalytics.summary.unavailable }
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              <Cell fill="#00C49F" />
              <Cell fill="#FF8042" />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Classroom Availability</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart 
            data={[
              { status: 'Available', count: analyticsData.classroomsAnalytics.summary.available },
              { status: 'Unavailable', count: analyticsData.classroomsAnalytics.summary.unavailable }
            ]}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8">
              <Cell fill="#00C49F" />
              <Cell fill="#FF8042" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="table-card">
      <h4>Classroom Status Summary</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Available</td>
            <td>{analyticsData.classroomsAnalytics.summary.available}</td>
            <td>
              {analyticsData.classroomsAnalytics.summary.total > 0 
                ? ((analyticsData.classroomsAnalytics.summary.available / analyticsData.classroomsAnalytics.summary.total) * 100).toFixed(1)
                : 0}%
            </td>
          </tr>
          <tr>
            <td>Unavailable</td>
            <td>{analyticsData.classroomsAnalytics.summary.unavailable}</td>
            <td>
              {analyticsData.classroomsAnalytics.summary.total > 0 
                ? ((analyticsData.classroomsAnalytics.summary.unavailable / analyticsData.classroomsAnalytics.summary.total) * 100).toFixed(1)
                : 0}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

const renderCarsAnalytics = () => (
  <div className="analytics-section">
    <h3>Cars Analytics</h3>
    <div className="kpi-grid">
      <div className="kpi-card">
        <h4>Total Cars</h4>
        <div className="kpi-value">{analyticsData.carsAnalytics.summary.total}</div>
      </div>
      <div className="kpi-card">
        <h4>Assigned to Instructors</h4>
        <div className="kpi-value approved">{analyticsData.carsAnalytics.summary.assigned}</div>
      </div>
      <div className="kpi-card">
        <h4>Unassigned</h4>
        <div className="kpi-value rejected">{analyticsData.carsAnalytics.summary.unassigned}</div>
      </div>
      <div className="kpi-card">
        <h4>Average Year</h4>
        <div className="kpi-value">{analyticsData.carsAnalytics.summary.avgYear}</div>
      </div>
    </div>

    <div className="charts-grid">
      <div className="chart-card">
        <h4>Car Condition Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analyticsData.carsAnalytics.conditionDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ condition, percent }) => `${condition} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {analyticsData.carsAnalytics.conditionDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Cars by Year Range</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.carsAnalytics.yearDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="yearRange" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#00C49F" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Cars by Category</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.carsAnalytics.categoryDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#FFBB28" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4>Car Assignment Status</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={[
                { name: 'Assigned', value: analyticsData.carsAnalytics.summary.assigned },
                { name: 'Unassigned', value: analyticsData.carsAnalytics.summary.unassigned }
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              <Cell fill="#00C49F" />
              <Cell fill="#FF8042" />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="table-card">
      <h4>Car Assignment Details</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>License Plate</th>
            <th>Brand & Model</th>
            <th>Category</th>
            <th>Year</th>
            <th>Condition</th>
            <th>Instructor</th>
            <th>Driving Category</th>
          </tr>
        </thead>
        <tbody>
          {analyticsData.carsAnalytics.instructorAssignment.map((car, index) => (
            <tr key={index}>
              <td>{car.licensePlate}</td>
              <td>{car.brand} {car.model}</td>
              <td>{car.category}</td>
              <td>{car.year}</td>
              <td>{car.condition}</td>
              <td className={car.instructorName === 'Unassigned' ? 'unassigned' : 'assigned'}>
                {car.instructorName}
              </td>
              <td>{car.drivingCategory || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="table-card">
      <h4>Car Statistics Summary</h4>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Cars</td>
            <td>{analyticsData.carsAnalytics.summary.total}</td>
            <td>100%</td>
          </tr>
          <tr>
            <td>Assigned to Instructors</td>
            <td>{analyticsData.carsAnalytics.summary.assigned}</td>
            <td>
              {analyticsData.carsAnalytics.summary.total > 0 
                ? ((analyticsData.carsAnalytics.summary.assigned / analyticsData.carsAnalytics.summary.total) * 100).toFixed(1)
                : 0}%
            </td>
          </tr>
          <tr>
            <td>Unassigned</td>
            <td>{analyticsData.carsAnalytics.summary.unassigned}</td>
            <td>
              {analyticsData.carsAnalytics.summary.total > 0 
                ? ((analyticsData.carsAnalytics.summary.unassigned / analyticsData.carsAnalytics.summary.total) * 100).toFixed(1)
                : 0}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

return (
  <div className="analytics-container">
    <div className="tab-navigation">
      <button 
        className={`tab-button ${activeTab === 'applications' ? 'active' : ''}`}
        onClick={() => setActiveTab('applications')}
      >
        Applications Analytics
      </button>
      <button 
        className={`tab-button ${activeTab === 'students' ? 'active' : ''}`}
        onClick={() => setActiveTab('students')}
      >
        Students Analytics
      </button>
      <button 
        className={`tab-button ${activeTab === 'instructors' ? 'active' : ''}`}
        onClick={() => setActiveTab('instructors')}
      >
        Instructors Analytics
      </button>
      <button 
        className={`tab-button ${activeTab === 'teachers' ? 'active' : ''}`}
        onClick={() => setActiveTab('teachers')}
      >
        Teachers/Groups Analytics
      </button>
        <button 
    className={`tab-button ${activeTab === 'lessons' ? 'active' : ''}`}
    onClick={() => setActiveTab('lessons')}
  >
    Lessons Analytics
  </button>
  <button 
    className={`tab-button ${activeTab === 'exams' ? 'active' : ''}`}
    onClick={() => setActiveTab('exams')}
  >
    Exams Analytics
  </button>
  <button 
  className={`tab-button ${activeTab === 'cars' ? 'active' : ''}`}
  onClick={() => setActiveTab('cars')}
>
  Cars Analytics
</button>
  <button 
  className={`tab-button ${activeTab === 'classrooms' ? 'active' : ''}`}
  onClick={() => setActiveTab('classrooms')}
>
  Classrooms Analytics
</button>
    </div>
    {activeTab === 'applications' && renderApplicationsAnalytics()}
    {activeTab === 'students' && renderStudentsAnalytics()}
    {activeTab === 'instructors' && renderInstructorsAnalytics()}
    {activeTab === 'teachers' && renderTeachersAnalytics()}
    {activeTab === 'lessons' && renderLessonsAnalytics()}
{activeTab === 'exams' && renderExamsAnalytics()}
{activeTab === 'classrooms' && renderClassroomsAnalytics()}
{activeTab === 'cars' && renderCarsAnalytics()}
  </div>
);
};

export default AnalyticsComponent;